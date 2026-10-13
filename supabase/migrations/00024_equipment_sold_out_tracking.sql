-- =====================================================================
-- equipment에 "품절(재입고 추적)" 상태 컬럼을 추가하고, sync_runs에
-- 재입고 건수 컬럼을 추가한다.
--
-- 지금까지 자동 동기화(upsertEquipmentMultiBrand)는 이번 크롤링에서
-- 발견되지 않은 품목을 그냥 건드리지 않고 내버려 뒀다 — 품절/단종이든
-- 일시적 크롤링 누락이든 구분 없이 조용히 방치됐고, 삭제도 하지 않으니
-- 견적서 작성 화면에는 계속 "구매 가능한" 품목으로 남아 보였다.
--
-- is_sold_out = true 인 품목은 완전히 삭제하지 않고(과거 견적서 참조,
-- 가격 이력 등을 보존) DB에는 남기되, 견적서 작성 화면의 장비 선택
-- 목록에서는 제외한다(lib/db/equipment-repo.ts getAllEquipment/
-- searchEquipment 참고). 다음 동기화에서 같은 품목이 다시 발견되면
-- 자동으로 false 로 되돌아간다(reconcileSoldOutStatus 참고).
-- =====================================================================

alter table public.equipment
  add column if not exists is_sold_out boolean not null default false;

comment on column public.equipment.is_sold_out is
  '퐁당닷컴 동기화에서 더 이상 발견되지 않아 품절/판매중단으로 간주된 품목이면 true. 삭제하지 않고 견적서 작성 화면의 장비 선택 목록에서만 제외한다. 이후 동기화에서 다시 발견되면 자동으로 false로 복원된다.';

alter table public.sync_runs
  add column if not exists sold_out_count integer not null default 0,
  add column if not exists restored_count integer not null default 0;

comment on column public.sync_runs.sold_out_count is
  '이번 실행에서 더 이상 발견되지 않아 새로 품절(is_sold_out=true) 처리된 품목 수.';
comment on column public.sync_runs.restored_count is
  '이번 실행에서 품절(is_sold_out=true) 상태였다가 다시 발견되어 재입고(false)로 복원된 품목 수.';
