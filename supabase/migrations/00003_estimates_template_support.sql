-- =====================================================================
-- estimates 테이블이 "템플릿"(template_name 이 있는 행)도 저장할 수 있도록
-- provider_id / receiver_id / estimate_number 를 nullable 로 변경합니다.
--
-- 템플릿(예: "오픈워터 패키지")은 특정 공급자/수신자/발행일에 묶이지 않는
-- 장비 구성표이므로 이 값들이 없어도 저장할 수 있어야 합니다. 대신 실제
-- 견적서(template_name 이 null 인 행)는 이 값들이 반드시 있어야 하므로,
-- CHECK 제약으로 두 가지 경우를 모두 강제합니다.
-- =====================================================================

alter table public.estimates
  alter column provider_id drop not null,
  alter column receiver_id drop not null,
  alter column estimate_number drop not null;

alter table public.estimates
  add constraint estimates_real_quote_requires_core_fields
  check (
    template_name is not null
    or (
      provider_id is not null
      and receiver_id is not null
      and estimate_number is not null
    )
  );

comment on constraint estimates_real_quote_requires_core_fields on public.estimates is
  '템플릿(template_name 존재)이 아닌 실제 견적서는 provider_id/receiver_id/estimate_number 가 반드시 있어야 함';
