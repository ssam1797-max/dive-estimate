-- =====================================================================
-- create_estimate_with_items 함수를 다중 등급 가격 스냅샷을 함께 저장하도록
-- 갱신한다. p_price_tier(저장 시점 선택 등급)와, p_items 의 각 항목에
-- price_retail/price_instructor/price_center/price_cost 4개 필드가 추가됐다.
--
-- 함수 파라미터 개수가 바뀌므로(오버로드가 아니라 완전한 대체), create or
-- replace 만으로는 기존 시그니처 함수가 별도 오버로드로 남아있게 되어
-- PostgREST 가 어떤 것을 호출할지 모호해질 수 있다 — 기존 시그니처를
-- 명시적으로 drop 한 뒤 새로 만든다.
-- =====================================================================

drop function if exists public.create_estimate_with_items(
  text, date, uuid, uuid, text, text, jsonb
);

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
    estimate_id, equipment_id, color, size, quantity, unit_price, item_remarks,
    price_retail, price_instructor, price_center, price_cost
  )
  select
    v_estimate_id,
    nullif(item ->> 'equipment_id', '')::uuid,
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
  '견적서/템플릿과 그 하위 항목들을 하나의 트랜잭션으로 저장합니다. total_amount 는 서버에서 재계산합니다. 항목별로 4개 가격 등급 단가 스냅샷도 함께 저장합니다.';
