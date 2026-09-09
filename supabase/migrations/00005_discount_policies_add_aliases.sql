-- =====================================================================
-- discount_policies 에 aliases(별칭) 컬럼 추가.
--
-- lib/db/discount-policy-repo.ts 는 브랜드별 할인율 정책을 조회/저장할 때
-- 이 컬럼을 이미 사용하고 있었지만(다른 언어/표기의 브랜드명으로도 같은
-- 정책을 찾기 위함 — 예: "마레스"로 조회해도 "Mares" 정책을 찾음),
-- 00001_init_schema.sql 에는 이 컬럼이 누락되어 있었습니다.
-- =====================================================================

alter table public.discount_policies
  add column if not exists aliases text[] not null default '{}'::text[];

comment on column public.discount_policies.aliases is
  '같은 할인율 정책을 적용할 다른 표기(한글 브랜드명, 대소문자 변형 등)';
