-- =====================================================================
-- profiles 에 팩스 번호 컬럼 추가.
--
-- 거래명세서 기능을 추가하면서, 실제 사용 중인 거래명세서 양식(첨부된
-- 엑셀 원본)을 확인해보니 공급자 정보에 "팩스" 항목이 있었다 — 지금까지
-- 견적서에는 필요 없어 빠져 있던 필드다. contact(전화)와 동일하게
-- PROVIDER 전용, RECEIVER 는 보통 비어있다(null).
-- =====================================================================

alter table public.profiles
  add column if not exists fax text;

comment on column public.profiles.fax is '팩스 번호 (PROVIDER 전용, 거래명세서에 표시)';
