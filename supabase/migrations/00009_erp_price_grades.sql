-- 판매가 등급(A·B·C)과 거래처 단가 등급.
-- 매출·견적 전표에서 품목을 고르면 거래처 등급에 맞는 판매가가 자동으로 들어간다(수정 가능).
-- acct_items.sale_price 를 A 가격으로 쓰고, B·C 가격 칸을 추가한다.

alter table public.acct_items
  add column if not exists sale_price_b numeric(18,2),
  add column if not exists sale_price_c numeric(18,2);

comment on column public.acct_items.sale_price is '판매가 A(기본)';
comment on column public.acct_items.sale_price_b is '판매가 B — 비어 있으면 A 가격을 쓴다';
comment on column public.acct_items.sale_price_c is '판매가 C — 비어 있으면 A 가격을 쓴다';

alter table public.acct_partners
  add column if not exists price_grade text not null default 'A';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'acct_partners_price_grade_check') then
    alter table public.acct_partners
      add constraint acct_partners_price_grade_check check (price_grade in ('A', 'B', 'C'));
  end if;
end $$;

comment on column public.acct_partners.price_grade is '단가 등급(A·B·C) — 매출·견적 입력 시 품목 판매가를 고르는 기준';

-- 경영박사 ITEM.OUTB(두 번째 판매가)를 B 가격으로 옮긴다. (OUTC 이하는 모두 비어 있었음)
update public.acct_items i
set sale_price_b = v.price
from (values
  (101, 303800), (103, 1402500), (104, 552500), (109, 2514000), (110, 55000),
  (111, 32500), (112, 28000), (113, 40000), (115, 40000), (116, 12000),
  (119, 1504500), (120, 15000), (124, 96000), (125, 63000), (126, 232000),
  (129, 1175180), (141, 276000), (142, 847200), (166, 720000), (173, 2634500)
) as v(legacy_code, price)
where i.legacy_code = v.legacy_code and i.sale_price_b is null;
