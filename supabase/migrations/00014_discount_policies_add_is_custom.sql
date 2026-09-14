-- =====================================================================
-- 브랜드 할인율 정책(discount_policies)에도 수동 변경 보호 플래그 추가
--
-- equipment.is_custom(00013)과 같은 목적 — "브랜드 할인율 설정" 화면에서
-- 사람이 직접 저장한 할인율을, "퐁당닷컴 할인율 동기화" 버튼이 최신
-- 크롤링 값으로 덮어써 버리는 문제를 막는다.
--
-- is_custom = true 인 브랜드는 퐁당닷컴 동기화가 해당 브랜드의 공급가
-- (rate_center)를 절대 덮어쓰지 않는다(app/api/discount-policies/
-- sync-pongdang-shop/route.ts 참고). 사람이 "브랜드 할인율 설정" 화면에서
-- 저장 버튼을 누른 브랜드만 true가 되고, 동기화로 값이 채워지거나
-- 갱신된 브랜드는 계속 false로 남는다.
-- =====================================================================

alter table public.discount_policies
  add column if not exists is_custom boolean not null default false;

comment on column public.discount_policies.is_custom is
  '사용자가 "브랜드 할인율 설정" 화면에서 직접 저장한 정책이면 true. 퐁당닷컴 동기화 시 true인 브랜드는 공급가(rate_center)를 덮어쓰지 않는다.';
