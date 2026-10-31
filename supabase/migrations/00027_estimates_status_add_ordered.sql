-- =====================================================================
-- 견적서 상태에 'ordered'(발주완료) 추가.
--
-- 보관함의 [발주 복사]/[공유]로 카카오톡·문자 발주를 보낸 뒤, 어떤 견적서를
-- 이미 발주했는지 구분하기 위한 상태. 00011 에서 컬럼에 인라인으로 만든
-- CHECK 제약(자동 이름 estimates_status_check)을 새 값 목록으로 교체한다.
-- 기존 데이터는 바뀌지 않는다.
-- =====================================================================

alter table public.estimates
  drop constraint if exists estimates_status_check;

alter table public.estimates
  add constraint estimates_status_check
    check (status in ('draft', 'sent', 'approved', 'ordered', 'cancelled'));

comment on column public.estimates.status is
  '견적서 진행 상태: draft(작성중) / sent(발송됨) / approved(승인됨) / ordered(발주완료) / cancelled(취소됨). 템플릿 행에는 의미 없음.';
