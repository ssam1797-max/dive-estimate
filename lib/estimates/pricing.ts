/**
 * 가격 버전(소비자/강사/센터/원가) 계산 로직.
 * 브라우저(미리보기)와 서버(엑셀 다운로드) 양쪽에서 동일한 계산 결과를
 * 보장하기 위해 순수 함수로 분리했습니다. ("server-only" 를 import 하지 않음)
 */

export type PriceTier = "RETAIL" | "INSTRUCTOR" | "CENTER" | "COST";

export const PRICE_TIERS: PriceTier[] = ["RETAIL", "INSTRUCTOR", "CENTER", "COST"];

export const PRICE_TIER_LABELS: Record<PriceTier, string> = {
  RETAIL: "소비자가",
  INSTRUCTOR: "샵가",
  CENTER: "공급가",
  COST: "원가",
};

/** discount_policies 1행에 해당하는 브랜드별 할인율 (%) */
export interface BrandDiscountRates {
  rate_retail: number;
  rate_instructor: number;
  rate_center: number;
  rate_cost: number;
}

/** 브랜드명 -> 할인율 맵 */
export type DiscountPolicyMap = Record<string, BrandDiscountRates>;

/**
 * discount_policies 행 목록(브랜드 + 별칭 + 등급별 할인율)을 DiscountPolicyMap
 * 으로 변환한다. 브라우저(장비 수정 다이얼로그의 실시간 할인 미리보기)와
 * 서버(discount-policy-repo.getDiscountPolicyMap) 양쪽에서 완전히 같은
 * 별칭 매핑 규칙을 쓰기 위해 순수 함수로 분리했다.
 */
export function buildDiscountPolicyMap(
  policies: { brand: string; aliases: string[]; rate_retail: number; rate_instructor: number; rate_center: number; rate_cost: number }[]
): DiscountPolicyMap {
  const map: DiscountPolicyMap = {};
  for (const p of policies) {
    const rates: BrandDiscountRates = {
      rate_retail: p.rate_retail,
      rate_instructor: p.rate_instructor,
      rate_center: p.rate_center,
      rate_cost: p.rate_cost,
    };
    map[p.brand] = rates;
    for (const alias of p.aliases) {
      const trimmed = alias.trim();
      if (trimmed) map[trimmed] = rates;
    }
  }
  return map;
}

function rateForTier(tier: PriceTier, rates: BrandDiscountRates | undefined): number {
  if (!rates) return 0;
  switch (tier) {
    case "RETAIL":
      return rates.rate_retail;
    case "INSTRUCTOR":
      return rates.rate_instructor;
    case "CENTER":
      return rates.rate_center;
    case "COST":
      return rates.rate_cost;
    default:
      return 0;
  }
}

/** 대소문자뿐 아니라 앞뒤/연속 공백 차이도 무시하고 비교하기 위한 키. */
function normalizeBrandKey(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * discountPolicies[brand] 직접 조회는 대소문자/공백 차이에 취약하다 — 실제로
 * 할인율 정책은 "Scubapro"(영문, 브랜드 설정 화면에서 수동 입력)로 등록돼
 * 있는데, 장비 마스터의 brand 값은 크롤러가 그대로 가져온 "SCUBAPRO"(전체
 * 대문자)나 "마레스"(한글)라, 정확히 일치하는 키가 없어 항상 rate=0(정책 없음)
 * 으로 빠지는 게 실제 버그였다 — 가격 탭을 바꿔도 단가가 안 바뀐 이유.
 * 대소문자/앞뒤 공백을 무시하고 비교해서 이 불일치를 흡수한다.
 */
function findDiscountRates(
  brand: string,
  discountPolicies: DiscountPolicyMap
): BrandDiscountRates | undefined {
  if (discountPolicies[brand]) return discountPolicies[brand];
  const target = normalizeBrandKey(brand);
  for (const key of Object.keys(discountPolicies)) {
    if (normalizeBrandKey(key) === target) return discountPolicies[key];
  }
  return undefined;
}

/**
 * 부동소수점 이진 표현 오차 보정 절사. 예: 109000 * (1 - 33/100) 의 수학적으로
 * 정확한 값은 73030(정수)이지만, 0.33 이 이진수로 정확히 표현되지 않아 JS에서
 * 73029.99999999999 로 계산될 수 있다 — 이걸 그냥 Math.floor 하면 정당하게 원
 * 단위여야 할 값에서 1원이 부당하게 깎여나간다. 실제 소수점(할인율 계산상 진짜
 * 남는 원 미만 잔돈)만 절사하고, 부동소수점 노이즈는 무시하도록 아주 작은
 * epsilon 을 더한 뒤 버림 처리한다.
 */
function floorWon(value: number): number {
  return Math.floor(value + 1e-6);
}

/**
 * 정가(listPrice = 소비자가격, price_retail)에 브랜드별 수동 할인율 정책
 * (discount_policies, [브랜드 할인율 설정] 화면에서 사용자가 직접 입력)을
 * 적용한 실제 단가를 계산합니다 — "소비자가격 기준 직격" 방식으로, 다른 티어를
 * 거쳐 누적 차감하지 않고 매번 price_retail 에서 곧바로 계산합니다:
 *   - 소비자가(RETAIL):   price_retail (할인 0%)
 *   - 강사가(INSTRUCTOR): price_retail * (1 - 브랜드 수동 강사할인율/100)
 *   - 센터가(CENTER):     price_retail * (1 - 브랜드 수동 센터할인율/100)
 *   - 원가(COST):         price_retail * (1 - 브랜드 수동 원가할인율/100)
 *
 * 해당 브랜드에 할인율 정책이 등록되어 있지 않으면 할인 없이 정가를 그대로
 * 사용합니다.
 *
 * listPrice 는 항상 number 여야 하지만, 크롤러/외부 데이터 소스를 거쳐 들어온
 * 값이 문자열로 새어 들어오는 경우를 대비해 Number() 로 한 번 더 강제 변환한다.
 *
 * 결과값은 소수점을 버리는 절사(floorWon)로 원단위까지 정리한다.
 */
export function calculateEffectiveUnitPrice(
  listPrice: number,
  brand: string,
  tier: PriceTier,
  discountPolicies: DiscountPolicyMap
): number {
  const numericListPrice = Number(listPrice);
  if (!Number.isFinite(numericListPrice)) return 0;

  const rate = rateForTier(tier, findDiscountRates(brand, discountPolicies));
  return Math.max(0, floorWon(numericListPrice * (1 - rate / 100)));
}

/**
 * 부가세 포함가 정책: 견적서에 표시되는 단가/금액은 이미 부가세가 포함된
 * 최종 판매 금액이다 — 별도로 10%를 더 얹지 않고, 그 금액 안에서 부가세
 * 몫을 역산해서 보여준다(금액 ÷ 1.1 = 공급가액, 금액 - 공급가액 = 부가세,
 * 즉 금액 × 10/110 = 금액 ÷ 11).
 */
export function calculateInclusiveVat(amount: number): number {
  return Math.round(amount / 11);
}

/**
 * 소비자가격(listPrice) 대비 현재 단가(unitPrice)의 할인율(%)을 계산합니다.
 * 화면 표기용으로 소수점 첫째 자리까지 반올림합니다 (예: 15.5, 20).
 *
 * - listPrice 가 0 이하이거나 유효하지 않으면 비교 기준이 없으므로 0을 반환합니다.
 * - unitPrice 가 listPrice 이상(할인 없음/직접 인상 입력)이면 0을 반환합니다 — 이
 *   테이블의 "할인율" 표기는 소비자가격보다 싸질 때만 의미가 있습니다.
 */
export function calculateDiscountRate(listPrice: number, unitPrice: number): number {
  const numericListPrice = Number(listPrice);
  const numericUnitPrice = Number(unitPrice);
  if (!Number.isFinite(numericListPrice) || numericListPrice <= 0) return 0;
  if (!Number.isFinite(numericUnitPrice)) return 0;

  const rate = ((numericListPrice - numericUnitPrice) / numericListPrice) * 100;
  if (rate <= 0) return 0;

  return Math.round(rate * 10) / 10;
}

/** 할인율(%) 표시용 문자열 변환 — 정수면 "20", 아니면 "15.5" 형태로 소수점 첫째 자리까지. */
export function formatDiscountRate(rate: number): string {
  return Number.isInteger(rate) ? `${rate}` : rate.toFixed(1);
}

/**
 * 저장된 견적서 항목의 등급별 단가 스냅샷 중 원하는 등급의 값을 돌려준다.
 * 이 스냅샷 기능이 추가되기 전에 저장된 견적서(전부 null)는 저장 당시의
 * 단일 unitPrice 로 폴백한다 — 인쇄/수정/보관함/복제 화면이 전부 같은
 * 규칙을 따라야 등급 탭을 바꿔도 금액이 일관된다.
 */
export function tierPriceOfSnapshot(
  item: {
    unitPrice: number;
    priceRetail: number | null;
    priceInstructor: number | null;
    priceCenter: number | null;
    priceCost: number | null;
  },
  tier: PriceTier
): number {
  const snapshot: Record<PriceTier, number | null> = {
    RETAIL: item.priceRetail,
    INSTRUCTOR: item.priceInstructor,
    CENTER: item.priceCenter,
    COST: item.priceCost,
  };
  return snapshot[tier] ?? item.unitPrice;
}
