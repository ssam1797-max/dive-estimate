-- =====================================================================
-- 품목별 수동 변경 보호 플래그(is_custom) 추가
--
-- 퐁당닷컴/스쿠버프로 공홈 크롤링, PDF 카탈로그 업로드 등 자동 동기화가
-- equipment 테이블을 브랜드+연도+모델명 기준으로 upsert 하면서, 사용자가
-- "장비 목록(수정/삭제)" 화면이나 "직접 등록" 화면에서 수동으로 등록/수정한
-- 값(이름, 소비자가격, 예외 할인율 등)까지 최신 크롤링 데이터로 덮어써
-- 버리는 문제가 있었다.
--
-- is_custom = true 인 품목은 자동 동기화가 절대 덮어쓰거나 삭제하지
-- 않는다(lib/db/equipment-repo.ts 의 upsertEquipmentBulk 참고). 사람이
-- 직접 등록/수정한 품목만 true가 되고, 자동 동기화로 들어오거나 갱신된
-- 품목은 계속 false로 남는다.
-- =====================================================================

alter table public.equipment
  add column if not exists is_custom boolean not null default false;

comment on column public.equipment.is_custom is
  '사용자가 직접 등록/수정한 품목이면 true. 퐁당닷컴 등 자동 동기화 시 true인 품목은 덮어쓰거나 삭제하지 않고 그대로 유지한다.';
