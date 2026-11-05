-- =====================================================================
-- 옵션 전용 보완 작업을 위한 준비.
--
-- 1. pongdang_goods_id: 퐁당닷컴 상품 번호. 지금까지는 목록 크롤링 중에만
--    메모리에 있어서, 상세페이지를 열려면 목록을 먼저 다시 받아야 했다.
--    저장해 두면 옵션 보완이 목록 크롤링과 분리되어 독립적으로 돌 수 있다.
-- 2. option_checked_at 초기화: 지금까지의 확인 기록은 "확인은 했지만 옵션은
--    다음 동기화에서 지워진" 상태라 믿을 수 없다. 전부 다시 확인한다.
-- =====================================================================

alter table public.equipment
  add column if not exists pongdang_goods_id text;

comment on column public.equipment.pongdang_goods_id is
  '퐁당닷컴 상품 번호(/goods/view?no=). 동기화 때 채워지며, 옵션 보완 작업이 상세페이지를 바로 열 때 쓴다.';

update public.equipment
set option_checked_at = null
where option_checked_at is not null;

create index if not exists equipment_option_backfill_idx
  on public.equipment (option_checked_at nulls first)
  where is_custom = false and is_sold_out = false and pongdang_goods_id is not null;
