-- =====================================================================
-- 장비(품목)별 예외 할인율 컬럼 추가
--
-- 지금까지는 discount_policies 테이블에 등록된 "브랜드" 단위 할인율만
-- 있었다. 특정 품목 하나만 다른 할인율을 적용해야 하는 경우(예: 특정
-- 모델만 프로모션 할인, 반대로 특정 모델은 할인 없이 정가 유지)를 위해
-- equipment 테이블에 품목별 예외 할인율을 추가한다.
--
-- NULL이면(기본값) 기존과 동일하게 브랜드 할인율(discount_policies)을
-- 그대로 사용하고, 값이 채워져 있으면 4개 가격 등급(소비자가/샵가/
-- 공급가/원가) 전부에서 브랜드 할인율 대신 이 값이 최우선 적용된다
-- (lib/estimates/pricing.ts 의 calculateEffectiveUnitPrice 참고).
-- =====================================================================

alter table public.equipment
  add column if not exists override_discount_rate numeric(5, 2)
    check (override_discount_rate is null or override_discount_rate between 0 and 100);

comment on column public.equipment.override_discount_rate is
  '품목별 예외 할인율(%, 0~100). NULL이면 브랜드 기본 할인율(discount_policies)을 사용하고, 값이 있으면 모든 가격 등급 계산에서 브랜드 할인율보다 최우선 적용된다.';
