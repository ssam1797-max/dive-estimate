-- =====================================================================
-- equipment 에 "확인 필요(가격 변동 검토 대기)" 상태를 영구 저장하는 컬럼을
-- 추가한다.
--
-- 지금까지 "가격 변동 확인 필요"는 동기화 1회 응답(EquipmentImportSummary)
-- 안에서만 계산되고 화면(SyncResultDialog)을 닫으면 사라지는 값이었다 —
-- 그 자리에서 바로 결정하지 않으면 다음 동기화 때 다시 감지될 때까지 그
-- 품목이 가격 변동 상태였다는 사실 자체를 알 방법이 없었다. 이제 보호
-- (is_custom=true) 품목의 가격이 퐁당닷컴 최신가와 달라지면 그 값을 여기에
-- 남겨두고, "확인 필요 품목" 탭에서 동기화 세션과 무관하게 언제든 모아볼 수
-- 있게 한다.
-- =====================================================================

alter table public.equipment
  add column if not exists pending_review_price numeric,
  add column if not exists pending_review_detected_at timestamptz;

comment on column public.equipment.pending_review_price is
  '수동 보호(is_custom) 품목의 동기화 중 감지된 새 퐁당닷컴 가격. 현재 price_retail과 다를 때만 채워지며, 관리자가 반영하거나 현재가 유지로 확인 완료 처리하면 NULL로 돌아간다.';
comment on column public.equipment.pending_review_detected_at is
  'pending_review_price가 감지된 시각(가장 최근 동기화 기준).';
