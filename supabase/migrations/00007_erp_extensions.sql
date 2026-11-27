-- ERP(경영박사 대체) 확장: 재고관리 여부, 기초재고, 견적 → 매출/매입 전환 연결, 재고 뷰.
-- 기존 acct_* 테이블에 컬럼/뷰를 "추가"만 한다. 기존 데이터와 기존 뷰 동작은 바뀌지 않는다.

-- 1) 품목: 재고관리 여부 + 기초재고
alter table public.acct_items
  add column if not exists track_stock boolean not null default false,
  add column if not exists opening_stock numeric(18,4) not null default 0;

comment on column public.acct_items.track_stock is
  '재고관리 품목이면 true — 매입하면 재고 +, 매출하면 재고 − (견적은 반영 안 함)';
comment on column public.acct_items.opening_stock is
  '기초재고(경영박사에서 옮겨온 시점 재고를 맞추기 위한 보정값 포함)';

-- 2) 전표: 어느 견적에서 전환됐는지
alter table public.acct_vouchers
  add column if not exists source_voucher_id bigint
    references public.acct_vouchers(id) on delete set null;

create index if not exists acct_vouchers_source_idx
  on public.acct_vouchers(source_voucher_id);

-- 3) 품목별 현재고 뷰 (RLS 를 그대로 따르도록 security_invoker)
create or replace view public.acct_item_stock
with (security_invoker = true) as
select
  i.id as item_id,
  i.track_stock,
  i.opening_stock,
  coalesce(sum(case when v.kind = 'purchase' then l.qty else 0 end), 0) as purchased_qty,
  coalesce(sum(case when v.kind = 'sale' then l.qty else 0 end), 0) as sold_qty,
  i.opening_stock
    + coalesce(sum(case when v.kind = 'purchase' then l.qty
                        when v.kind = 'sale' then -l.qty
                        else 0 end), 0) as stock
from public.acct_items i
left join public.acct_voucher_lines l on l.item_id = i.id
left join public.acct_vouchers v on v.id = l.voucher_id
group by i.id;

-- 4) 데이터 보정: 경영박사(DR.mdb ITEM.JEGO)에서 재고가 0이 아니던 8개 품목을
--    재고관리 품목으로 켜고, 현재고가 경영박사 값과 같아지도록 기초재고를 맞춘다.
with target(legacy_code, jego) as (
  values (107, -8), (109, -2), (111, -1), (112, -1),
         (113, -2), (123, -2), (151, 4), (153, -1)
), moved as (
  select i.id, t.jego,
         coalesce(sum(case when v.kind = 'purchase' then l.qty
                           when v.kind = 'sale' then -l.qty
                           else 0 end), 0) as net
  from target t
  join public.acct_items i on i.legacy_code = t.legacy_code
  left join public.acct_voucher_lines l on l.item_id = i.id
  left join public.acct_vouchers v on v.id = l.voucher_id
  group by i.id, t.jego
)
update public.acct_items i
set track_stock = true,
    opening_stock = m.jego - m.net
from moved m
where i.id = m.id;
