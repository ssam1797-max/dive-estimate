-- =====================================================================
-- 스마트 다이빙 장비 관리 및 멀티 가격 견적 시스템
-- 초기 스키마 마이그레이션 (equipment, discount_policies, profiles,
-- estimates, estimate_items)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 공통 함수: updated_at 자동 갱신 트리거
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. equipment: 브랜드/장비 마스터 테이블
-- ---------------------------------------------------------------------
create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  category text not null,
  name text not null,
  price_retail numeric(12, 2) not null default 0 check (price_retail >= 0),
  colors text[] not null default '{}'::text[],
  sizes text[] not null default '{}'::text[],
  catalog_year integer check (catalog_year between 1990 and 2100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.equipment is '브랜드/장비 마스터 테이블';
comment on column public.equipment.brand is '브랜드명 (예: Scubapro, Mares, Cressi 등)';
comment on column public.equipment.category is '장비 종류 (예: BCD, 레귤레이터, 슈트, 마스크, 핀 등)';
comment on column public.equipment.name is '장비명(모델명)';
comment on column public.equipment.price_retail is '소비자 가격(정가)';
comment on column public.equipment.colors is '선택 가능한 색상 목록';
comment on column public.equipment.sizes is '선택 가능한 사이즈 목록';
comment on column public.equipment.catalog_year is '카탈로그 연도';

create index if not exists idx_equipment_brand on public.equipment (brand);
create index if not exists idx_equipment_category on public.equipment (category);
create index if not exists idx_equipment_brand_category on public.equipment (brand, category);

drop trigger if exists trg_equipment_set_updated_at on public.equipment;
create trigger trg_equipment_set_updated_at
  before update on public.equipment
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 2. discount_policies: 브랜드별 할인율 정책 테이블
-- ---------------------------------------------------------------------
create table if not exists public.discount_policies (
  id uuid primary key default gen_random_uuid(),
  brand text not null unique,
  rate_retail numeric(5, 2) not null default 0 check (rate_retail between 0 and 100),
  rate_instructor numeric(5, 2) not null default 0 check (rate_instructor between 0 and 100),
  rate_center numeric(5, 2) not null default 0 check (rate_center between 0 and 100),
  rate_cost numeric(5, 2) not null default 0 check (rate_cost between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.discount_policies is '브랜드별 할인율 정책 테이블 (브랜드당 1개 정책)';
comment on column public.discount_policies.brand is '브랜드명 (equipment.brand 와 매칭)';
comment on column public.discount_policies.rate_retail is '소비자 할인율(%), 0~100';
comment on column public.discount_policies.rate_instructor is '강사 할인율(%), 0~100';
comment on column public.discount_policies.rate_center is '센터(다이빙샵) 할인율(%), 0~100';
comment on column public.discount_policies.rate_cost is '원가 할인율(%), 0~100';

drop trigger if exists trg_discount_policies_set_updated_at on public.discount_policies;
create trigger trg_discount_policies_set_updated_at
  before update on public.discount_policies
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 3. profiles: 견적서 공급자/수신자 프로필 테이블
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'profile_type') then
    create type public.profile_type as enum ('PROVIDER', 'RECEIVER');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  type public.profile_type not null,
  name text not null,
  contact text,
  address text,
  stamp_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '견적서에 사용되는 공급자/수신자 프로필 테이블';
comment on column public.profiles.type is 'PROVIDER(공급자) 또는 RECEIVER(수신자)';
comment on column public.profiles.name is '상호명 또는 이름';
comment on column public.profiles.contact is '연락처';
comment on column public.profiles.address is '주소';
comment on column public.profiles.stamp_url is '도장(직인) 이미지 경로 - 공급자(PROVIDER) 프로필에 사용';

create index if not exists idx_profiles_type on public.profiles (type);

drop trigger if exists trg_profiles_set_updated_at on public.profiles;
create trigger trg_profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. estimates: 견적서 마스터 테이블
-- ---------------------------------------------------------------------
create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  estimate_number text not null unique,
  date date not null default current_date,
  provider_id uuid not null references public.profiles (id) on delete restrict,
  receiver_id uuid not null references public.profiles (id) on delete restrict,
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  remarks text,
  template_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.estimates is '견적서 마스터 테이블';
comment on column public.estimates.estimate_number is '견적서 번호 (yymmdd-01 형식, 예: 260824-01)';
comment on column public.estimates.date is '발행일';
comment on column public.estimates.provider_id is '공급자 프로필 ID (profiles.type = PROVIDER 권장)';
comment on column public.estimates.receiver_id is '수신자 프로필 ID (profiles.type = RECEIVER 권장)';
comment on column public.estimates.total_amount is '견적 총액 (estimate_items 합계)';
comment on column public.estimates.remarks is '견적서 전체 비고';
comment on column public.estimates.template_name is '템플릿으로 저장할 때의 이름. 일반 견적서는 null';

create index if not exists idx_estimates_provider_id on public.estimates (provider_id);
create index if not exists idx_estimates_receiver_id on public.estimates (receiver_id);
create index if not exists idx_estimates_date on public.estimates (date);
create index if not exists idx_estimates_template_name on public.estimates (template_name)
  where template_name is not null;

drop trigger if exists trg_estimates_set_updated_at on public.estimates;
create trigger trg_estimates_set_updated_at
  before update on public.estimates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. estimate_items: 견적서 상세 항목(품목) 테이블
-- ---------------------------------------------------------------------
create table if not exists public.estimate_items (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  equipment_id uuid references public.equipment (id) on delete set null,
  color text,
  size text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  item_remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.estimate_items is '견적서 상세 항목(품목) 테이블';
comment on column public.estimate_items.estimate_id is '소속 견적서 ID (estimates)';
comment on column public.estimate_items.equipment_id is '장비 마스터 ID (equipment). 장비 삭제 시 null 처리';
comment on column public.estimate_items.color is '선택된 색상';
comment on column public.estimate_items.size is '선택된 사이즈';
comment on column public.estimate_items.quantity is '수량';
comment on column public.estimate_items.unit_price is '적용 단가 (할인율 반영 후 실제 견적가)';
comment on column public.estimate_items.item_remarks is '항목별 비고';

create index if not exists idx_estimate_items_estimate_id on public.estimate_items (estimate_id);
create index if not exists idx_estimate_items_equipment_id on public.estimate_items (equipment_id);

drop trigger if exists trg_estimate_items_set_updated_at on public.estimate_items;
create trigger trg_estimate_items_set_updated_at
  before update on public.estimate_items
  for each row execute function public.set_updated_at();

-- =====================================================================
-- Row Level Security
-- 사내 견적 관리 시스템을 가정하여, 로그인한(authenticated) 사용자에게
-- 전체 CRUD 권한을 허용하는 기본 정책만 설정합니다.
-- 추후 관리자/직원 등 역할이 구체화되면 정책을 세분화하세요.
-- =====================================================================
alter table public.equipment enable row level security;
alter table public.discount_policies enable row level security;
alter table public.profiles enable row level security;
alter table public.estimates enable row level security;
alter table public.estimate_items enable row level security;

drop policy if exists "authenticated_full_access" on public.equipment;
create policy "authenticated_full_access" on public.equipment
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.discount_policies;
create policy "authenticated_full_access" on public.discount_policies
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.profiles;
create policy "authenticated_full_access" on public.profiles
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.estimates;
create policy "authenticated_full_access" on public.estimates
  for all to authenticated using (true) with check (true);

drop policy if exists "authenticated_full_access" on public.estimate_items;
create policy "authenticated_full_access" on public.estimate_items
  for all to authenticated using (true) with check (true);
