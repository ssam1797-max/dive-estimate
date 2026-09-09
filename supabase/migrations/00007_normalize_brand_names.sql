-- =====================================================================
-- 브랜드명 표기 통합.
--
-- 소스마다 브랜드 표기가 달랐다 — 퐁당닷컴 크롤러는 한글("스쿠버프로"),
-- 스쿠버프로 공식 홈페이지 동기화는 영문 대문자("SCUBAPRO",
-- lib/equipment/constants.ts SCUBAPRO_SYNC_BRAND), 관리자가 브랜드 할인율
-- 설정 화면에 직접 입력하면 임의 표기("Scubapro" 등)가 들어갈 수 있었다.
-- lib/equipment/normalizeBrand.ts 가 이제 모든 저장 경로
-- (lib/db/equipment-repo.ts, lib/db/discount-policy-repo.ts)에서 표준
-- 한글 표기로 정규화하지만, 이 스크립트를 실행하기 전에 이미 다른 표기로
-- 저장된 과거 데이터는 코드 배포만으로는 바뀌지 않는다. 이 스크립트가 그
-- 과거 데이터를 정리한다.
--
-- 멱등(idempotent)하다 — 이미 표준 표기로만 저장돼 있다면 아무 것도
-- 바뀌지 않으므로, 실제로 어긋난 데이터가 없는 상태에서 실행해도 안전하다.
-- =====================================================================

-- 1) equipment.brand: 알려진 변형 표기를 표준 한글 표기로 갱신
update public.equipment
set brand = '스쿠버프로'
where lower(trim(brand)) = 'scubapro' and brand <> '스쿠버프로';

update public.equipment
set brand = '마레스'
where lower(trim(brand)) = 'mares' and brand <> '마레스';

update public.equipment
set brand = '크레씨'
where lower(trim(brand)) = 'cressi' and brand <> '크레씨';

update public.equipment
set brand = '아쿠아렁'
where lower(trim(brand)) = 'aqualung' and brand <> '아쿠아렁';

-- 2) discount_policies: 표준 표기가 아닌 중복 행이 있으면 표준 표기 행에
-- 병합(원래 표기를 별칭으로 흡수)하고 중복 행은 삭제한다. 표준 표기 행이
-- 아직 없으면 그 행의 이름만 표준 표기로 바꾼다.
do $$
declare
  mapping record;
  canonical_id uuid;
  dup record;
begin
  for mapping in
    select * from (values
      ('scubapro', '스쿠버프로'),
      ('mares', '마레스'),
      ('cressi', '크레씨'),
      ('aqualung', '아쿠아렁')
    ) as t(variant_lower, canonical)
  loop
    select id into canonical_id
    from public.discount_policies
    where brand = mapping.canonical;

    for dup in
      select * from public.discount_policies
      where lower(trim(brand)) = mapping.variant_lower
        and brand <> mapping.canonical
    loop
      if canonical_id is null then
        update public.discount_policies
        set brand = mapping.canonical
        where id = dup.id;
        canonical_id := dup.id;
      else
        update public.discount_policies
        set aliases = array(select distinct unnest(aliases || array[dup.brand]))
        where id = canonical_id;

        delete from public.discount_policies where id = dup.id;
      end if;
    end loop;
  end loop;
end
$$;

-- 3) 방어적 이중 안전장치: 표준 표기 행에 알려진 변형 표기를 별칭으로
-- 미리 등록해둔다. 앞으로 어떤 경로로든 정규화를 거치지 않은 표기가
-- 들어오더라도, findDiscountRates()/findDiscountPolicyByBrandOrAlias() 의
-- 별칭 매칭으로 여전히 올바른 할인율을 찾을 수 있다.
update public.discount_policies
set aliases = array(select distinct unnest(aliases || array['SCUBAPRO', 'Scubapro', 'scubapro']))
where brand = '스쿠버프로';

update public.discount_policies
set aliases = array(select distinct unnest(aliases || array['MARES', 'Mares', 'mares']))
where brand = '마레스';

update public.discount_policies
set aliases = array(select distinct unnest(aliases || array['CRESSI', 'Cressi', 'cressi']))
where brand = '크레씨';

update public.discount_policies
set aliases = array(select distinct unnest(aliases || array['AQUALUNG', 'Aqualung', 'aqualung']))
where brand = '아쿠아렁';
