-- =====================================================================
-- 견적서에 할인 품목(음수 단가)을 담을 수 있도록 허용.
--
-- 00001 에서 컬럼에 인라인으로 만든 CHECK 제약 2개를 제거한다.
--   - estimate_items.unit_price >= 0 : 할인 품목은 음수 단가로 저장한다.
--   - estimates.total_amount >= 0    : 할인이 품목 금액보다 커 합계가 음수가
--     되더라도 저장 단계에서 알 수 없는 오류로 막히지 않게 한다.
-- 기존 데이터는 바뀌지 않는다. equipment.price_retail 제약은 그대로 둔다
-- (할인 품목은 장비 마스터가 아니라 estimate_items 에만 저장된다).
-- =====================================================================

alter table public.estimate_items
  drop constraint if exists estimate_items_unit_price_check;

alter table public.estimates
  drop constraint if exists estimates_total_amount_check;
