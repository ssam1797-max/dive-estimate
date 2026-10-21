-- =====================================================================
-- equipment에 실제 수집된 샵가/공급가/원가 컬럼을 추가한다.
--
-- 지금까지 샵가(INSTRUCTOR)/공급가(CENTER)/원가(COST) 3개 등급은 전부
-- price_retail(소비자가)에 브랜드별로 관리자가 손으로 입력한 할인율
-- (discount_policies)을 곱해 "추정"했다 — 실제 퐁당닷컴 샵 계정 가격을
-- 반영한 게 아니었다.
--
-- 이제 퐁당닷컴 샵 계정으로 서버가 직접 로그인해(lib/crawler/
-- pongdangCrawler.ts) 품목별 실제 샵가를 수집한다. 수집된 품목은 이
-- 실제값을 쓰고(lib/estimates/pricing.ts calculateEffectiveUnitPrice),
-- 아직 수집 안 된 품목은 기존 브랜드 할인율 방식으로 계속 폴백한다.
-- =====================================================================

alter table public.equipment
  -- 퐁당닷컴 샵 계정으로 로그인해 수집한 실제 판매가(샵가, INSTRUCTOR 등급).
  -- 동기화 때마다 덮어쓴다(가격 변동 반영). 아직 수집 안 됐으면 null.
  add column if not exists price_instructor numeric,
  -- 공급가(CENTER 등급). 기본은 price_instructor * 0.98 로 자동 계산되지만,
  -- price_center_overridden=true 인 품목은 동기화가 건드리지 않고 관리자가
  -- 입력한 값을 그대로 유지한다.
  add column if not exists price_center numeric,
  -- true면 관리자가 "장비 목록" 화면에서 공급가를 직접 고정한 것 —
  -- 품목 전체를 보호(is_custom) 상태로 만들지 않고 이 값 하나만 보호한다.
  -- 동기화는 이 플래그가 true인 품목의 price_center는 재계산하지 않는다.
  add column if not exists price_center_overridden boolean not null default false,
  -- 원가(COST 등급). 자동 수집/계산 대상이 아니다 — 관리자가 직접 입력하며,
  -- 동기화는 이 컬럼을 절대 건드리지 않는다.
  add column if not exists price_cost numeric;

comment on column public.equipment.price_instructor is
  '퐁당닷컴 샵 계정 로그인으로 수집한 실제 샵가(INSTRUCTOR 등급). 동기화마다 갱신됨.';
comment on column public.equipment.price_center is
  '공급가(CENTER 등급). price_center_overridden=false면 price_instructor*0.98로 자동 계산, true면 관리자가 직접 입력한 값 유지.';
comment on column public.equipment.price_center_overridden is
  '공급가를 관리자가 직접 고정했으면 true — 동기화가 재계산하지 않는다.';
comment on column public.equipment.price_cost is
  '원가(COST 등급). 전적으로 관리자가 직접 입력하는 값이며 동기화가 건드리지 않는다.';
