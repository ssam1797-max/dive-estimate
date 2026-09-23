-- =====================================================================
-- estimate_items 에 명시적 정렬 순서(sort_order) 컬럼을 추가한다.
--
-- 지금까지는 품목 순서를 "저장할 때 넘긴 배열 순서대로 insert 된 뒤,
-- 조회 시 created_at 으로 정렬"하는 방식에 암묵적으로 의존했다. 문제는
-- create_estimate_with_items/update_estimate_with_items 가 한 items 배열
-- 전체를 단일 insert 문으로 넣기 때문에, 모든 행의 created_at(now())이
-- 트랜잭션 타임스탬프로 전부 동일하다는 점이다 — SQL 표준상 정렬 키가
-- 전부 같은 값이면 그 안에서의 순서는 보장되지 않는다(대개는 물리적
-- 저장 순서를 따라가지만 이는 우연일 뿐 보장이 아니다). 특히 이번에
-- 추가하는 "품목 순서 변경(위/아래 이동)" 기능은 사용자가 배열 순서를
-- 임의로 재배치한 뒤 다시 저장하므로, 그 순서가 정확히 보존된다는 보장이
-- 반드시 필요하다.
--
-- item_name/item_brand/item_category 를 추가했던 00016 과 같은 이유로,
-- 이 컬럼도 estimate_items 자체에 직접 저장한다.
-- =====================================================================

alter table public.estimate_items
  add column if not exists sort_order integer;

comment on column public.estimate_items.sort_order is '견적서 내 품목 표시 순서(0부터 시작). 저장 시 클라이언트가 넘긴 배열 순서대로 서버가 매긴다.';

-- 이 마이그레이션 이전에 저장된 기존 행은 sort_order 가 비어 있으므로,
-- estimate_id 별로 기존 created_at(동률이면 id) 순서를 그대로 보존해
-- 0부터 채워 넣는다 — 기존 견적서의 화면상 품목 순서가 이 마이그레이션
-- 실행으로 인해 바뀌는 일이 없다.
with ranked as (
  select id, row_number() over (
    partition by estimate_id order by created_at, id
  ) - 1 as rn
  from public.estimate_items
  where sort_order is null
)
update public.estimate_items ei
set sort_order = ranked.rn
from ranked
where ei.id = ranked.id;

alter table public.estimate_items
  alter column sort_order set default 0,
  alter column sort_order set not null;

create index if not exists idx_estimate_items_estimate_sort
  on public.estimate_items (estimate_id, sort_order);

-- ── create_estimate_with_items / update_estimate_with_items 갱신 ──────────
-- jsonb_array_elements 대신 jsonb_array_elements ... with ordinality 를 써서
-- 각 품목이 p_items 배열에서 몇 번째였는지(1부터 시작하는 ordinality)를
-- 함께 뽑아 sort_order(0부터 시작)로 저장한다.

create or replace function public.create_estimate_with_items(
  p_estimate_number text,
  p_date date,
  p_provider_id uuid,
  p_receiver_id uuid,
  p_remarks text,
  p_template_name text,
  p_price_tier text,
  p_items jsonb
) returns uuid
language plpgsql
as $$
declare
  v_estimate_id uuid;
  v_total numeric(14, 2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '견적 항목이 비어 있습니다.' using errcode = '22023';
  end if;

  select coalesce(
    sum((item ->> 'unit_price')::numeric * (item ->> 'quantity')::int),
    0
  )
    into v_total
  from jsonb_array_elements(p_items) as item;

  insert into public.estimates (
    estimate_number, date, provider_id, receiver_id,
    total_amount, remarks, template_name, price_tier
  )
  values (
    p_estimate_number,
    coalesce(p_date, current_date),
    p_provider_id,
    p_receiver_id,
    v_total,
    p_remarks,
    p_template_name,
    p_price_tier
  )
  returning id into v_estimate_id;

  insert into public.estimate_items (
    estimate_id, equipment_id, item_name, item_brand, item_category,
    color, size, quantity, unit_price, item_remarks,
    price_retail, price_instructor, price_center, price_cost, sort_order
  )
  select
    v_estimate_id,
    nullif(item ->> 'equipment_id', '')::uuid,
    nullif(item ->> 'item_name', ''),
    nullif(item ->> 'item_brand', ''),
    nullif(item ->> 'item_category', ''),
    nullif(item ->> 'color', ''),
    nullif(item ->> 'size', ''),
    (item ->> 'quantity')::int,
    (item ->> 'unit_price')::numeric,
    nullif(item ->> 'item_remarks', ''),
    (item ->> 'price_retail')::numeric,
    (item ->> 'price_instructor')::numeric,
    (item ->> 'price_center')::numeric,
    (item ->> 'price_cost')::numeric,
    (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);

  return v_estimate_id;
end;
$$;

comment on function public.create_estimate_with_items is
  '견적서/템플릿과 그 하위 항목들을 하나의 트랜잭션으로 저장합니다. total_amount 는 서버에서 재계산합니다. 항목별로 품명/브랜드/카테고리, 정렬 순서(sort_order), 4개 가격 등급 단가 스냅샷도 함께 저장합니다.';

create or replace function public.update_estimate_with_items(
  p_id uuid,
  p_estimate_number text,
  p_date date,
  p_provider_id uuid,
  p_receiver_id uuid,
  p_remarks text,
  p_price_tier text,
  p_items jsonb
) returns uuid
language plpgsql
as $$
declare
  v_total numeric(14, 2);
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception '견적 항목이 비어 있습니다.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.estimates where id = p_id and template_name is null
  ) then
    raise exception '수정할 견적서를 찾을 수 없습니다.' using errcode = 'P0002';
  end if;

  select coalesce(
    sum((item ->> 'unit_price')::numeric * (item ->> 'quantity')::int),
    0
  )
    into v_total
  from jsonb_array_elements(p_items) as item;

  update public.estimates
  set
    estimate_number = p_estimate_number,
    date = coalesce(p_date, current_date),
    provider_id = p_provider_id,
    receiver_id = p_receiver_id,
    remarks = p_remarks,
    price_tier = p_price_tier,
    total_amount = v_total
  where id = p_id;

  delete from public.estimate_items where estimate_id = p_id;

  insert into public.estimate_items (
    estimate_id, equipment_id, item_name, item_brand, item_category,
    color, size, quantity, unit_price, item_remarks,
    price_retail, price_instructor, price_center, price_cost, sort_order
  )
  select
    p_id,
    nullif(item ->> 'equipment_id', '')::uuid,
    nullif(item ->> 'item_name', ''),
    nullif(item ->> 'item_brand', ''),
    nullif(item ->> 'item_category', ''),
    nullif(item ->> 'color', ''),
    nullif(item ->> 'size', ''),
    (item ->> 'quantity')::int,
    (item ->> 'unit_price')::numeric,
    nullif(item ->> 'item_remarks', ''),
    (item ->> 'price_retail')::numeric,
    (item ->> 'price_instructor')::numeric,
    (item ->> 'price_center')::numeric,
    (item ->> 'price_cost')::numeric,
    (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality as t(item, ordinality);

  return p_id;
end;
$$;

comment on function public.update_estimate_with_items is
  '저장된 실제 견적서(템플릿 제외) 1건을 id 기준으로 통째로 갱신합니다. estimate_items 는 delete 후 재삽입하는 전체 대체 방식이며, total_amount 는 서버에서 재계산합니다. 항목별로 품명/브랜드/카테고리, 정렬 순서(sort_order)도 함께 갱신합니다.';
