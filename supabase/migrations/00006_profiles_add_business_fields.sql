-- =====================================================================
-- profiles 에 관공서 납품용 견적서 공급자 정보 컬럼 추가.
--
-- lib/db/profile-repo.ts 와 견적서 문서(EstimateDocumentTable/
-- buildEstimateWorkbook) 는 이 컬럼들을 이미 사용하고 있었지만
-- (사업번호/대표자/업태/종목/이메일), 00001_init_schema.sql 에는
-- 누락되어 있었습니다. RECEIVER 프로필에는 보통 비어있고(null),
-- PROVIDER(공급자) 프로필에만 채워집니다.
-- =====================================================================

alter table public.profiles
  add column if not exists business_number text,
  add column if not exists representative text,
  add column if not exists business_type text,
  add column if not exists business_category text,
  add column if not exists email text;

comment on column public.profiles.business_number is '사업자등록번호 (PROVIDER 전용)';
comment on column public.profiles.representative is '대표자명 (PROVIDER 전용)';
comment on column public.profiles.business_type is '업태 (PROVIDER 전용)';
comment on column public.profiles.business_category is '종목 (PROVIDER 전용)';
comment on column public.profiles.email is '이메일 (PROVIDER 전용)';
