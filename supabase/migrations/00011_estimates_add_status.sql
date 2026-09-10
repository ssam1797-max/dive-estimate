-- =====================================================================
-- 견적서 진행 상태(작성중/발송됨/승인됨/취소됨) 추적을 위한 컬럼 추가.
--
-- 기존에 저장된 모든 견적서(과거 데이터)는 실제로는 이미 고객에게
-- 발송됐을 가능성이 높지만, 저장 시점 상태를 알 수 없으므로 안전하게
-- 'draft'로 기본값을 둔다 — 필요하면 화면에서 직접 상태를 변경하면 된다.
-- template_name 이 있는 행(템플릿)에는 의미가 없는 값이라 신경 쓰지
-- 않아도 된다.
-- =====================================================================

alter table public.estimates
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'sent', 'approved', 'cancelled'));

comment on column public.estimates.status is
  '견적서 진행 상태: draft(작성중) / sent(발송됨) / approved(승인됨) / cancelled(취소됨). 템플릿 행에는 의미 없음.';

create index if not exists idx_estimates_status on public.estimates (status)
  where template_name is null;
