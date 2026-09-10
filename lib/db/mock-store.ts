import "server-only";

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface MockEquipment {
  id: string;
  brand: string;
  category: string;
  name: string;
  price_retail: number;
  colors: string[];
  sizes: string[];
  catalog_year: number | null;
  created_at: string;
  updated_at: string;
}

export interface MockDiscountPolicy {
  id: string;
  brand: string;
  /** 같은 할인율 정책을 적용할 다른 표기(한글 브랜드명, 대소문자 변형 등). */
  aliases: string[];
  rate_retail: number;
  rate_instructor: number;
  rate_center: number;
  rate_cost: number;
  created_at: string;
  updated_at: string;
}

export interface MockProfile {
  id: string;
  type: "PROVIDER" | "RECEIVER";
  name: string;
  contact: string | null;
  address: string | null;
  stamp_url: string | null;
  business_number?: string | null;
  representative?: string | null;
  business_type?: string | null;
  business_category?: string | null;
  email?: string | null;
}

export interface MockEstimate {
  id: string;
  estimate_number: string;
  date: string;
  provider_id: string;
  receiver_id: string;
  total_amount: number;
  remarks: string | null;
  template_name: string | null;
  /** 저장 시점 선택되어 있던 가격 등급 ("RETAIL"|"INSTRUCTOR"|"CENTER"|"COST"). 템플릿은 null. */
  price_tier: string | null;
  /** "draft"|"sent"|"approved"|"cancelled". 템플릿 행에는 의미 없음. */
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MockEstimateItem {
  id: string;
  estimate_id: string;
  equipment_id: string | null;
  color: string | null;
  size: string | null;
  quantity: number;
  unit_price: number;
  item_remarks: string | null;
  /** 저장 시점 4개 가격 등급 단가 스냅샷. */
  price_retail: number | null;
  price_instructor: number | null;
  price_center: number | null;
  price_cost: number | null;
  created_at: string;
}

export interface MockStore {
  equipment: MockEquipment[];
  discountPolicies: MockDiscountPolicy[];
  profiles: MockProfile[];
  estimates: MockEstimate[];
  estimateItems: MockEstimateItem[];
}

// ── 시드 데이터 ───────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();

// ── Seed 데이터 ID 상수 (유효한 UUID v4 형식) ────────────────────────────────
const EQ_ID_1 = "a1b2c3d4-e001-4000-8000-000000000010";
const EQ_ID_2 = "a1b2c3d4-e002-4000-8000-000000000020";
const EQ_ID_3 = "a1b2c3d4-e003-4000-8000-000000000030";
const EQ_ID_4 = "a1b2c3d4-e004-4000-8000-000000000040";
const EQ_ID_5 = "a1b2c3d4-e005-4000-8000-000000000050";
const DP_ID_1 = "a1b2c3d4-d001-4000-8000-000000000010";
const DP_ID_2 = "a1b2c3d4-d002-4000-8000-000000000020";
const DP_ID_3 = "a1b2c3d4-d003-4000-8000-000000000030";
const DP_ID_4 = "a1b2c3d4-d004-4000-8000-000000000040";
const PROVIDER_ID = "a1b2c3d4-0001-4000-8000-000000000001";
const RECEIVER_ID = "a1b2c3d4-0002-4000-8000-000000000002";

const SEED_EQUIPMENT: MockEquipment[] = [
  {
    id: EQ_ID_1,
    brand: "Scubapro",
    category: "BCD",
    name: "Hydros Pro",
    price_retail: 1280000,
    colors: ["블랙", "네이비", "화이트"],
    sizes: ["XS", "S", "M", "L", "XL"],
    catalog_year: 2026,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: EQ_ID_2,
    brand: "Scubapro",
    category: "레귤레이터",
    name: "MK25 EVO / A700",
    price_retail: 1650000,
    colors: ["블랙"],
    sizes: [],
    catalog_year: 2026,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: EQ_ID_3,
    brand: "Mares",
    category: "마스크",
    name: "X-Vision Ultra",
    price_retail: 95000,
    colors: ["블랙", "화이트", "블루"],
    sizes: [],
    catalog_year: 2026,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: EQ_ID_4,
    brand: "Cressi",
    category: "핀",
    name: "Agua",
    price_retail: 89000,
    colors: ["블랙", "블루", "옐로우"],
    sizes: ["S", "M", "L", "XL"],
    catalog_year: 2026,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: EQ_ID_5,
    brand: "Aqualung",
    category: "다이빙 컴퓨터",
    name: "i770R",
    price_retail: 1150000,
    colors: ["블랙", "실버"],
    sizes: [],
    catalog_year: 2026,
    created_at: NOW,
    updated_at: NOW,
  },
];

const SEED_DISCOUNT_POLICIES: MockDiscountPolicy[] = [
  {
    id: DP_ID_1,
    brand: "Scubapro",
    // 크롤러가 그대로 저장한 장비 마스터의 실제 brand 표기(대문자/한글)를 별칭으로 등록해서
    // 대소문자·언어가 달라도 같은 할인율 정책이 적용되게 한다.
    aliases: ["SCUBAPRO", "스쿠버프로"],
    rate_retail: 0,
    rate_instructor: 30,
    rate_center: 40,
    rate_cost: 55,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: DP_ID_2,
    brand: "Mares",
    aliases: ["마레스"],
    rate_retail: 0,
    rate_instructor: 28,
    rate_center: 38,
    rate_cost: 50,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: DP_ID_3,
    brand: "Cressi",
    aliases: ["크레씨"],
    rate_retail: 0,
    rate_instructor: 25,
    rate_center: 35,
    rate_cost: 48,
    created_at: NOW,
    updated_at: NOW,
  },
  {
    id: DP_ID_4,
    brand: "Aqualung",
    aliases: ["아쿠아렁"],
    rate_retail: 0,
    rate_instructor: 27,
    rate_center: 37,
    rate_cost: 52,
    created_at: NOW,
    updated_at: NOW,
  },
];

const SEED_PROFILES: MockProfile[] = [
  {
    id: PROVIDER_ID,
    type: "PROVIDER",
    name: "오션다이브 강남점",
    contact: "02-1234-5678",
    address: "서울시 강남구 테헤란로 123 해양빌딩 4층",
    stamp_url: null,
    business_number: "123-45-67890",
    representative: "이춘형",
    business_type: "도소매",
    business_category: "스포츠용품",
    email: "info@oceandive.co.kr",
  },
  {
    id: RECEIVER_ID,
    type: "RECEIVER",
    name: "강진소방서",
    contact: "061-430-0119",
    address: "전라남도 강진군 강진읍 탐진로 43",
    stamp_url: null,
  },
];

// ── 싱글턴 (globalThis 로 HMR 재사용 보장) ───────────────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __mockStore: MockStore | undefined;
}

function createStore(): MockStore {
  return {
    equipment: structuredClone(SEED_EQUIPMENT),
    discountPolicies: structuredClone(SEED_DISCOUNT_POLICIES),
    profiles: structuredClone(SEED_PROFILES),
    estimates: [],
    estimateItems: [],
  };
}

if (!global.__mockStore) {
  global.__mockStore = createStore();
}

export const mockStore: MockStore = global.__mockStore;
