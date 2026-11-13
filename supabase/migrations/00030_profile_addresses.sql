-- =====================================================================
-- 공급받는자 배송지 주소록 + 견적서별 발주 배송지(스냅샷).
--
-- 강사가 발주한 장비를 강사 본인이 아니라 소비자에게 바로 보내는 경우가
-- 있어서, 공급받는자(RECEIVER) 프로필 하나가 여러 개의 "받는사람 이름 /
-- 연락처 / 주소" 를 가질 수 있게 한다.
--
-- 1) profile_addresses: 프로필별 주소록. 프로필이 삭제되면 함께 삭제된다.
-- 2) estimates.ship_to_*: 발주할 때 고른 배송지를 견적서에 "복사해서"
--    저장한다(스냅샷). 주소록 항목을 나중에 고치거나 지워도 이미 발주한
--    견적서의 배송지는 바뀌지 않는다. 세 값이 모두 null 이면 공급받는자
--    프로필의 기본 이름/연락처/주소로 발주한다(기존 동작과 동일).
-- =====================================================================

create table if not exists public.profile_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  label text,
  recipient_name text not null,
  contact text,
  address text not null,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_addresses is '공급받는자 프로필별 배송지 주소록 (발주 시 받는사람 선택용)';
comment on column public.profile_addresses.label is '구분 이름 (예: 홍길동 고객, 본인 자택) — 비워두면 받는사람 이름으로 표시';
comment on column public.profile_addresses.recipient_name is '받는사람 이름';
comment on column public.profile_addresses.contact is '받는사람 연락처';
comment on column public.profile_addresses.address is '배송 주소';
comment on column public.profile_addresses.memo is '배송 메모 (발주 문구에 함께 표시)';

create index if not exists idx_profile_addresses_profile_id
  on public.profile_addresses (profile_id);

drop trigger if exists trg_profile_addresses_set_updated_at on public.profile_addresses;
create trigger trg_profile_addresses_set_updated_at
  before update on public.profile_addresses
  for each row execute function public.set_updated_at();

alter table public.profile_addresses enable row level security;

drop policy if exists "authenticated_full_access" on public.profile_addresses;
create policy "authenticated_full_access" on public.profile_addresses
  for all to authenticated using (true) with check (true);

alter table public.estimates
  add column if not exists ship_to_name text,
  add column if not exists ship_to_contact text,
  add column if not exists ship_to_address text,
  add column if not exists ship_to_memo text;

comment on column public.estimates.ship_to_name is '발주 배송지 받는사람 (스냅샷). null 이면 공급받는자 프로필 정보 사용';
comment on column public.estimates.ship_to_contact is '발주 배송지 연락처 (스냅샷)';
comment on column public.estimates.ship_to_address is '발주 배송지 주소 (스냅샷)';
comment on column public.estimates.ship_to_memo is '발주 배송 메모 (스냅샷)';
