-- =====================================================================
-- 입금 계좌 정보 설정 (싱글턴 테이블)
-- 관리자 모드에서 설정한 은행명/계좌번호/예금주를 "구매요청" 주문 완료
-- 화면에 보여주기 위한 테이블. 행이 하나만 존재해야 하므로 id 를
-- boolean(always true) + primary key 로 둬서 두 번째 행이 생기지 않게 막는다.
-- =====================================================================

create table if not exists public.bank_account_settings (
  id boolean primary key default true,
  bank_name text not null default '',
  account_number text not null default '',
  account_holder text not null default '',
  updated_at timestamptz not null default now(),
  constraint bank_account_settings_singleton check (id)
);

insert into public.bank_account_settings (id)
values (true)
on conflict (id) do nothing;

comment on table public.bank_account_settings is
  '구매요청 주문 완료 화면에 보여줄 입금 계좌 정보. 항상 단일 행만 존재한다(관리자 모드에서 설정).';
