-- =====================================================================
-- estimate_items 에 품명/브랜드/카테고리를 항목 자체에도 저장한다.
--
-- 지금까지는 견적서 화면에 보이는 품명/브랜드/카테고리를 equipment 마스터
-- 테이블과의 조인으로만 얻었다. 이 때문에:
--   1) 견적서 작성 화면에서 품명을 수동으로 고쳐도 저장 시 반영할 곳이
--      없었다(equipment_id 만 저장되므로, 다시 불러오면 조인된 마스터
--      품명으로 되돌아간다).
--   2) 퐁당닷컴 검색 없이 사용자가 직접 입력한 품목(equipment_id 없음)은
--      저장할 수 있어도 다시 불러오면 이름이 전부 "(삭제된 장비)"로 나온다.
--   3) 나중에 그 장비가 마스터에서 삭제되면 과거 견적서의 품명까지 함께
--      사라진다.
--
-- item_name/item_brand/item_category 를 이 테이블에 직접 저장해 두고,
-- 조회 시 이 값을 최우선으로 쓰고(coalesce), 없으면(이 마이그레이션 이전에
-- 저장된 기존 행) 기존처럼 equipment 조인으로 폴백한다 — 과거 견적서는
-- 전혀 깨지지 않는다.
-- =====================================================================

alter table public.estimate_items
  add column if not exists item_name text,
  add column if not exists item_brand text,
  add column if not exists item_category text;

comment on column public.estimate_items.item_name is '이 항목의 품명 — 견적서 작성 화면에서 수동으로 고칠 수 있고, 퐁당닷컴 검색 없이 직접 추가한 품목도 이 값으로 표시된다. 이 컬럼 추가 이전 항목은 null(조인된 equipment.name 으로 폴백).';
comment on column public.estimate_items.item_brand is '이 항목의 브랜드 — item_name 과 동일한 이유로 저장. 이 컬럼 추가 이전 항목은 null(조인된 equipment.brand 로 폴백).';
comment on column public.estimate_items.item_category is '이 항목의 카테고리 — item_name 과 동일한 이유로 저장. 이 컬럼 추가 이전 항목은 null(조인된 equipment.category 로 폴백).';

-- create_estimate_with_items / update_estimate_with_items 는 p_items 의 JSON
-- 구조만 늘어나고 함수 파라미터 목록(개수/타입) 자체는 바뀌지 않으므로,
-- drop 없이 create or replace 로 충분하다.

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
    price_retail, price_instructor, price_center, price_cost
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
    (item ->> 'price_cost')::numeric
  from jsonb_array_elements(p_items) as item;

  return v_estimate_id;
end;
$$;

comment on function public.create_estimate_with_items is
  '견적서/템플릿과 그 하위 항목들을 하나의 트랜잭션으로 저장합니다. total_amount 는 서버에서 재계산합니다. 항목별로 품명/브랜드/카테고리와 4개 가격 등급 단가 스냅샷도 함께 저장합니다.';

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
    price_retail, price_instructor, price_center, price_cost
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
    (item ->> 'price_cost')::numeric
  from jsonb_array_elements(p_items) as item;

  return p_id;
end;
$$;

comment on function public.update_estimate_with_items is
  '저장된 실제 견적서(템플릿 제외) 1건을 id 기준으로 통째로 갱신합니다. estimate_items 는 delete 후 재삽입하는 전체 대체 방식이며, total_amount 는 서버에서 재계산합니다. 항목별로 품명/브랜드/카테고리도 함께 갱신합니다.';
