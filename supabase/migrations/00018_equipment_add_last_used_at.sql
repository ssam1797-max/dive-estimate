-- =====================================================================
-- equipment 에 "최근 사용 일시(last_used_at)" 컬럼을 추가하고, 견적서
-- 생성/수정 시 실제로 사용된(estimate_items.equipment_id 로 연결된) 품목의
-- last_used_at 을 자동으로 갱신한다.
--
-- "사용됨"의 기준은 템플릿이 아닌 실제 견적서(estimates.template_name is
-- null)에 저장되는 시점으로 한정한다 — 템플릿은 견적서 작성 화면과 같은
-- 검색/선택 UI를 그대로 타지만, 실제 거래로 이어지지 않은 사전 구성일
-- 뿐이라 "최근 사용"의 의미와는 맞지 않는다.
-- =====================================================================

alter table public.equipment
  add column if not exists last_used_at timestamptz;

comment on column public.equipment.last_used_at is
  '이 품목이 마지막으로 실제 견적서(템플릿 제외)에 저장된 시각. 검색 결과 정렬(최근 사용 우선)에 사용.';

create index if not exists idx_equipment_last_used_at
  on public.equipment (last_used_at desc);

-- ── create_estimate_with_items: 신규 저장 시, 템플릿이 아니면 last_used_at 갱신 ──
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

  if p_template_name is null then
    update public.equipment
    set last_used_at = now()
    where id in (
      select distinct nullif(item ->> 'equipment_id', '')::uuid
      from jsonb_array_elements(p_items) as item
      where nullif(item ->> 'equipment_id', '') is not null
    );
  end if;

  return v_estimate_id;
end;
$$;

comment on function public.create_estimate_with_items is
  '견적서/템플릿과 그 하위 항목들을 하나의 트랜잭션으로 저장합니다. total_amount 는 서버에서 재계산합니다. 항목별로 품명/브랜드/카테고리, 정렬 순서(sort_order), 4개 가격 등급 단가 스냅샷도 함께 저장합니다. 템플릿이 아니면 사용된 장비의 last_used_at 도 함께 갱신합니다.';

-- ── update_estimate_with_items: 항상 실제 견적서(템플릿 제외)라 무조건 갱신 ──
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

  update public.equipment
  set last_used_at = now()
  where id in (
    select distinct nullif(item ->> 'equipment_id', '')::uuid
    from jsonb_array_elements(p_items) as item
    where nullif(item ->> 'equipment_id', '') is not null
  );

  return p_id;
end;
$$;

comment on function public.update_estimate_with_items is
  '저장된 실제 견적서(템플릿 제외) 1건을 id 기준으로 통째로 갱신합니다. estimate_items 는 delete 후 재삽입하는 전체 대체 방식이며, total_amount 는 서버에서 재계산합니다. 항목별로 품명/브랜드/카테고리, 정렬 순서(sort_order)도 함께 갱신하고, 사용된 장비의 last_used_at 도 갱신합니다.';
