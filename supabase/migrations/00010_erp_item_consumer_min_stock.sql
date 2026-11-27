-- 경영박사 품목 등록의 소비가(권장소비자가)와 적정재고
alter table public.acct_items
  add column if not exists consumer_price numeric(14,2),
  add column if not exists min_stock numeric(14,3);

comment on column public.acct_items.consumer_price is '소비가(권장소비자가) — 견적·안내용, 비우면 없음';
comment on column public.acct_items.min_stock is '적정재고 — 현재고가 이보다 적으면 부족재고로 표시';
