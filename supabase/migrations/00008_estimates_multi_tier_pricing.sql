-- =====================================================================
-- 견적서 다중 등급 가격 지원 (스키마).
--
-- 지금까지는 견적서를 저장할 때 화면에서 선택했던 가격 등급(price_tier) 1개
-- 단가만 estimate_items.unit_price 에 저장했다. 그래서 저장된 견적서
-- 상세/인쇄 화면에서는 저장 당시 선택했던 등급 외 다른 등급(소비자가/강사가/
-- 샵가/원가)으로 전환해서 볼 수 없었다.
--
-- 이제 저장 시점에 4개 등급의 단가를 모두 함께 스냅샷으로 저장해서, 상세/
-- 인쇄 화면에서 등급 탭을 자유롭게 전환해 볼 수 있게 한다. 브랜드 할인율
-- 정책은 나중에 바뀔 수 있으므로, "저장 당시 실제로 적용됐던 단가"를 그대로
-- 보존하는 스냅샷 방식이다(정책이 바뀌어도 과거 견적서 금액은 안 바뀜).
--
-- 이 마이그레이션 이전에 저장된 견적서는 아래 4개 컬럼이 전부 null 이며,
-- 앱은 이 경우 기존 unit_price 하나로 폴백해서 표시한다(모든 탭에 같은
-- 금액이 보임).
-- =====================================================================

alter table public.estimates
  add column if not exists price_tier text
    check (price_tier is null or price_tier in ('RETAIL', 'INSTRUCTOR', 'CENTER', 'COST'));

comment on column public.estimates.price_tier is
  '저장 시점에 화면에서 선택되어 있던 가격 등급. 상세/인쇄 화면의 초기 선택 탭으로 쓰임. 템플릿 및 이 컬럼 추가 이전 견적서는 null.';

alter table public.estimate_items
  add column if not exists price_retail numeric(12, 2),
  add column if not exists price_instructor numeric(12, 2),
  add column if not exists price_center numeric(12, 2),
  add column if not exists price_cost numeric(12, 2);

comment on column public.estimate_items.price_retail is '저장 시점 소비자가 단가 스냅샷 (등급 탭 전환용). 이 컬럼 추가 이전 항목은 null.';
comment on column public.estimate_items.price_instructor is '저장 시점 강사가 단가 스냅샷.';
comment on column public.estimate_items.price_center is '저장 시점 샵(센터)가 단가 스냅샷.';
comment on column public.estimate_items.price_cost is '저장 시점 원가 단가 스냅샷.';
