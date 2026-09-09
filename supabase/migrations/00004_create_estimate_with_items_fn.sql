-- =====================================================================
-- 견적서(또는 템플릿) + 항목들을 한 번의 트랜잭션으로 원자적으로 저장하는 함수.
-- estimates 1행과 estimate_items N행을 함께 INSERT 하며, 도중에 오류가
-- 발생하면 전체가 롤백되어 항목 없는 빈 견적서가 남는 일이 없습니다.
--
-- p_items 는 아래 형태의 JSON 배열입니다:
--   [{ "equipment_id": "uuid|null", "color": "..", "size": "..",
--      "quantity": 1, "unit_price": 100000, "item_remarks": ".." }, ...]
--
-- total_amount 는 넘겨받은 항목들의 (수량 * 단가) 합계로 서버에서 직접
-- 계산하여, 클라이언트가 보낸 값을 신뢰하지 않습니다.
-- =====================================================================

create or replace function public.create_estimate_with_items(
  p_estimate_number text,
  p_date date,
  p_provider_id uuid,
  p_receiver_id uuid,
  p_remarks text,
  p_template_name text,
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
    total_amount, remarks, template_name
  )
  values (
    p_estimate_number,
    coalesce(p_date, current_date),
    p_provider_id,
    p_receiver_id,
    v_total,
    p_remarks,
    p_template_name
  )
  returning id into v_estimate_id;

  insert into public.estimate_items (
    estimate_id, equipment_id, color, size, quantity, unit_price, item_remarks
  )
  select
    v_estimate_id,
    nullif(item ->> 'equipment_id', '')::uuid,
    nullif(item ->> 'color', ''),
    nullif(item ->> 'size', ''),
    (item ->> 'quantity')::int,
    (item ->> 'unit_price')::numeric,
    nullif(item ->> 'item_remarks', '')
  from jsonb_array_elements(p_items) as item;

  return v_estimate_id;
end;
$$;

comment on function public.create_estimate_with_items is
  '견적서/템플릿과 그 하위 항목들을 하나의 트랜잭션으로 저장합니다. total_amount 는 서버에서 재계산합니다.';
