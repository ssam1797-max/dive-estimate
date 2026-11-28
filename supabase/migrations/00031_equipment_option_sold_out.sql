-- =====================================================================
-- 옵션별 품절 정보.
--
-- 1. option_sold_out: 퐁당닷컴 기준 품절인 옵션.
--    {"colors": [...], "sizes": [...], "combos": ["색상\t사이즈", ...]}
--    품절 옵션도 견적에는 담을 수 있어야 해서 colors/sizes 에서 빼지 않고
--    여기에 따로 둔다(lib/equipment/optionStock.ts).
-- 2. 전체 재확인은 새 코드 배포 뒤 00032 에서 한다(배포 전 옛 코드가 다시
--    확인 표시를 남기지 않도록 분리).
-- =====================================================================

alter table public.equipment
  add column if not exists option_sold_out jsonb not null
    default '{"colors": [], "sizes": [], "combos": []}'::jsonb;

comment on column public.equipment.option_sold_out is
  '퐁당닷컴 기준 품절 옵션. colors=전 사이즈 품절 색상, sizes=전 색상 품절 사이즈, combos=품절인 "색상<TAB>사이즈" 조합. 옵션 보완 작업이 채운다.';
