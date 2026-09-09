-- =====================================================================
-- 저장된 견적서를 "이어서 수정(덮어쓰기)" 할 수 있게 하는 함수.
--
-- create_estimate_with_items(00004, 00009)는 새 견적서를 INSERT 하는
-- 함수이고, 이 함수는 건드리지 않는다(기존 "새 견적서 저장" 흐름은 100%
-- 그대로 유지). 이 함수는 완전히 새로 추가되는 함수로, 기존 견적서 1건의
-- estimates 행을 UPDATE 하고 estimate_items 를 통째로 교체(delete → insert)
-- 한다 — 품목 목록은 항상 "전체 대체" 방식이라(추가/삭제/수정이 뒤섞여도
-- id 매칭 없이 그냥 새 목록으로 덮어쓰는 게 견적서 저장 로직과 일관됨),
-- 개별 항목을 diff 하지 않는다.
--
-- template_name 이 있는 행(템플릿)은 대상에서 제외해서, 실수로 템플릿을
-- 이 함수로 덮어쓰는 일이 없게 한다.
-- =====================================================================

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
    estimate_id, equipment_id, color, size, quantity, unit_price, item_remarks,
    price_retail, price_instructor, price_center, price_cost
  )
  select
    p_id,
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

  return p_id;
end;
$$;

comment on function public.update_estimate_with_items is
  '저장된 실제 견적서(템플릿 제외) 1건을 id 기준으로 통째로 갱신합니다. estimate_items 는 delete 후 재삽입하는 전체 대체 방식이며, total_amount 는 서버에서 재계산합니다.';
