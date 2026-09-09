/**
 * 브랜드명 표준화 유틸.
 *
 * 같은 브랜드가 소스에 따라 서로 다른 표기로 들어온다 — 퐁당닷컴 크롤러는
 * 한글("스쿠버프로"), 스쿠버프로 공식 홈페이지 동기화는 영문 대문자
 * ("SCUBAPRO", lib/equipment/constants.ts SCUBAPRO_SYNC_BRAND), 관리자가
 * 직접 입력하는 브랜드 할인율 설정 화면은 임의 표기("Scubapro" 등)를 쓸 수
 * 있다. 정규화 없이 저장하면 같은 브랜드가 equipment.brand /
 * discount_policies.brand 에 여러 행으로 갈라져, 할인율 매칭이 깨지고
 * 장비 추가 화면의 브랜드 목록에도 중복 항목이 뜬다.
 *
 * 이 함수는 장비/할인율 정책을 저장하는 모든 경로(수동 등록, PDF 업로드,
 * 공식 홈페이지 동기화, 브랜드 할인율 설정)의 공통 진입점
 * (lib/db/equipment-repo.ts, lib/db/discount-policy-repo.ts)에서 호출되어,
 * DB에 쓰기 전에 항상 표준 표기로 맞춘다.
 *
 * 표준 표기는 한글이다(이미 축적된 실 데이터 대부분이 한글이고, 앱 UI 전체가
 * 한글이라 한글 표기가 자연스럽다). 알려진 영문/변형 표기는 BRAND_ALIASES 에
 * 등록해서 매핑하고, 등록되지 않은 브랜드는 공백만 정리해 그대로 둔다.
 */

/**
 * 알려진 영문/변형 표기 -> 표준 한글 표기. 키는 소문자로 비교한다.
 * 아래 목록은 Wikipedia "List of diving equipment manufacturers" 및 개별
 * 검색으로 영문 브랜드명을 확인한 것만 등록한다(신뢰도 낮은 추측은 등록하지
 * 않는다 — 잘못 매핑하면 서로 다른 브랜드의 할인율 정책이 하나로 합쳐지는
 * 위험이 있다).
 */
const BRAND_ALIASES: Record<string, string> = {
  scubapro: "스쿠버프로",
  mares: "마레스",
  cressi: "크레씨",
  aqualung: "아쿠아렁",
  ikelite: "아이켈라이트",
  "fourth element": "포스엘리먼트",
  "mobby's": "모비스",
  mobbys: "모비스",
  oms: "오엠에스",
  halcyon: "헬시온",
  seac: "쎄악섭",
  tusa: "투사",
  gull: "걸",
  waterproof: "워터프루프",
  beuchat: "부샤",
  "dive rite": "다이브라이트",
  apeks: "아펙스",
  bism: "비즘",
  hollis: "홀리스",
  sherwood: "셔우드",
  scubaforce: "스쿠버포스",
  "deep see": "딥씨",
  apollo: "아폴로",
  bare: "베어",
  shearwater: "쉬어워터",
  "xs scuba": "엑스에스 스쿠바",
  oceanic: "오셔닉",
  "atomic aquatics": "아토믹",
  zeagle: "지글",
  "light monkey": "라이트 몽키",
  "kirby morgan": "커비모건",
  padi: "패디",
};

/** 앞뒤 공백 제거 + 연속 공백을 하나로 압축 (전각/반각 공백 혼용 대비 \s 사용). */
function collapseWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * 브랜드명을 표준 표기로 정규화한다.
 * - 앞뒤/연속 공백 정리
 * - 알려진 변형 표기(대소문자 무시)는 표준 한글 표기로 치환
 * - 등록되지 않은 브랜드는 공백만 정리된 원문 그대로 반환
 */
export function normalizeBrand(rawBrand: string): string {
  const collapsed = collapseWhitespace(rawBrand);
  const canonical = BRAND_ALIASES[collapsed.toLowerCase()];
  return canonical ?? collapsed;
}

/**
 * 표준 한글 표기(canonicalBrand)에 대해 알려진 영문 변형 표기를 돌려준다.
 * 데이터는 표준 표기로만 저장되지만("스쿠버프로"), 검색창에 "scubapro"를
 * 입력해도 찾을 수 있도록 브랜드 드롭다운의 검색 대상(설명)에 붙여 쓴다.
 */
export function getKnownBrandAliases(canonicalBrand: string): string[] {
  return Object.entries(BRAND_ALIASES)
    .filter(([, canonical]) => canonical === canonicalBrand)
    .map(([variant]) => variant);
}
