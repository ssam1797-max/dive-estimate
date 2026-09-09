-- =====================================================================
-- equipment 테이블에 (brand, catalog_year, name) 유니크 제약 추가
-- 카탈로그 PDF 자동 업로드 기능에서 "같은 브랜드/연도/이름" 기준으로
-- upsert(INSERT ... ON CONFLICT) 하기 위해 필요합니다.
--
-- 주의: catalog_year 가 null 인 행은 Postgres 유니크 제약 특성상 서로
-- 다른 값으로 취급되어 중복이 걸러지지 않습니다. 카탈로그 업로드로
-- 등록되는 장비는 항상 catalog_year 를 함께 저장하므로 문제가 없지만,
-- catalog_year 없이 수동 등록하는 장비가 있다면 이 점을 참고하세요.
-- =====================================================================

alter table public.equipment
  add constraint equipment_brand_year_name_key
  unique (brand, catalog_year, name);
