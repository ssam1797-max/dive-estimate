import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";
import type { EquipmentCatalogItem } from "@/lib/estimates/types";
import type {
  ParsedEquipmentItem,
  EquipmentImportItemResult,
  EquipmentImportItemStatus,
  PendingReviewEquipmentItem,
  SyncRunRecord,
} from "@/lib/equipment/types";
import { normalizeBrand } from "@/lib/equipment/normalizeBrand";
import { fetchAllPages } from "@/lib/db/paginate";

export interface UpsertBulkResult {
  insertedCount: number;
  updatedCount: number;
  /** 사용자가 직접 등록/수정한(is_custom=true) 품목이라 덮어쓰지 않고 건너뛴 개수 */
  protectedCount: number;
  failedCount: number;
  items: EquipmentImportItemResult[];
}

/**
 * price_retail 최종 방어선. 크롤러/AI 파싱 등 외부 데이터 소스에서 ₩, 콤마,
 * "원", 공백 같은 문자가 섞인 채로 들어와도 순수 정수로 강제 정제한다.
 * (이미 상류 크롤러들이 정제해서 넘기지만, 저장 직전에 한 번 더 보장한다.)
 */
function sanitizePriceRetail(value: number | string): number {
  const digitsOnly = String(value).replace(/[^0-9]/g, "");
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * 공급가(CENTER 등급) 자동 계산 비율 — 소비자가 기준 할인율에 2%p를
 * 추가로 얹는다("샵가에서 2% 더 할인"이 아니라 "소비자가 대비 할인율 자체를
 * 2%p 더 키운다"는 뜻). 예: 소비자가 100원, 샵가가 20% 할인된 80원이면
 * 공급가는 22% 할인된 78원 — 샵가(80)에 0.98을 곱한 78.4원이 아니다.
 */
const PRICE_CENTER_EXTRA_DISCOUNT_RATE = 0.02;

/** 소비자가·샵가로부터 공급가를 자동 계산한다(원 단위 절사).
 *  공급가 = 샵가 - 소비자가 × 2%p (= 소비자가 × (할인율 + 2%p)). */
function computePriceCenter(priceRetail: number, priceInstructor: number): number {
  return Math.floor(priceInstructor - priceRetail * PRICE_CENTER_EXTRA_DISCOUNT_RATE);
}

// ── 브랜드 목록 ────────────────────────────────────────────────────────────────
// equipment 테이블이 4천 건을 넘어가면서, 페이지네이션 없이 select 하면
// Supabase 기본 제한(1000행)에 걸려 브랜드 가나다순 뒤쪽(예: "스쿠버프로")이
// 통째로 안 보이는 게 실제 원인이었다("브랜드 검색이 안 된다"는 증상은 검색
// 로직이 아니라 이 truncation 때문이었다) — fetchAllPages() 로 전량을 가져온다.

export async function getEquipmentBrands(): Promise<string[]> {
  if (isMockMode()) {
    const brands = [...new Set(mockStore.equipment.map((e) => e.brand))].sort();
    return brands;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const rows = await fetchAllPages<{ brand: string }>((from, to) =>
    supabase
      .from("equipment")
      .select("brand", { count: "exact" })
      .order("brand")
      .range(from, to)
  );
  return [...new Set(rows.map((r) => r.brand))].sort();
}

// ── 전체 카탈로그 (견적서 작성용) ────────────────────────────────────────────

export async function getAllEquipment(): Promise<EquipmentCatalogItem[]> {
  if (isMockMode()) {
    return mockStore.equipment
      .filter((e) => !e.is_sold_out)
      .map((e) => ({
        id: e.id,
        brand: e.brand,
        category: e.category,
        name: e.name,
        price_retail: e.price_retail,
        colors: e.colors,
        sizes: e.sizes,
        override_discount_rate: e.override_discount_rate ?? null,
        image_url: e.image_url ?? null,
        price_instructor: e.price_instructor ?? null,
        price_center: e.price_center ?? null,
        price_center_overridden: e.price_center_overridden ?? false,
        price_cost: e.price_cost ?? null,
      }));
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  try {
    const rows = await fetchAllPages<{
      id: string;
      brand: string;
      category: string;
      name: string;
      price_retail: number | string;
      colors: string[] | null;
      sizes: string[] | null;
      override_discount_rate: number | string | null;
      image_url: string | null;
      price_instructor: number | string | null;
      price_center: number | string | null;
      price_center_overridden: boolean | null;
      price_cost: number | string | null;
    }>((from, to) =>
      supabase
        .from("equipment")
        .select(
          "id, brand, category, name, price_retail, colors, sizes, override_discount_rate, image_url, price_instructor, price_center, price_center_overridden, price_cost",
          { count: "exact" }
        )
        // 품절(is_sold_out=true) 품목은 삭제하지 않고 DB에 남겨두되, 견적서
        // 작성 화면의 장비 선택 목록에서는 제외한다(다시 발견되면 자동 복원).
        .eq("is_sold_out", false)
        .order("brand")
        .order("category")
        .order("name")
        .range(from, to)
    );
    return rows.map((row) => ({
      id: row.id,
      brand: row.brand,
      category: row.category,
      name: row.name,
      price_retail: Number(row.price_retail),
      colors: row.colors ?? [],
      sizes: row.sizes ?? [],
      override_discount_rate:
        row.override_discount_rate == null ? null : Number(row.override_discount_rate),
      image_url: row.image_url ?? null,
      price_instructor: row.price_instructor == null ? null : Number(row.price_instructor),
      price_center: row.price_center == null ? null : Number(row.price_center),
      price_center_overridden: Boolean(row.price_center_overridden),
      price_cost: row.price_cost == null ? null : Number(row.price_cost),
    }));
  } catch (error) {
    console.error(
      "getAllEquipment 조회 실패:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}

// ── 키워드 통합 검색 (견적서 작성 화면 상단 빠른 검색용) ───────────────────────
// 기존 getAllEquipment() 은 전체 카탈로그를 그대로 두고, 검색어 하나로
// brand/category/name 중 아무거나 매칭되면 찾아지는 별도 조회 함수를
// 추가한다 — 기존 3단계(브랜드→카테고리→장비) Combobox 흐름과 그 state 는
// 전혀 건드리지 않는다.

/** equipment 테이블에는 model_number 컬럼이 없어(name 컬럼이 "장비명(모델명)"
 *  역할을 겸함), 요청된 3필드(equipment_name/brand/model_number) 대신 실제
 *  스키마의 brand/category/name 세 컬럼을 대상으로 검색한다. */
// 견적서 작성 화면의 "키워드 통합 검색"(드롭다운)은 검색 결과가 많을 때
// 상위 20건만 보이고 뒤쪽이 잘리는 문제가 있어(가나다순 정렬상 자주 쓰는
// 품목이 뒤로 밀려도 안 보임), limit<=0 을 "전체 결과" 요청으로 취급해
// fetchAllPages 로 상한 없이 가져온다. "장비 목록(수정/삭제)" 화면처럼
// 명시적으로 개수를 제한하고 싶은 호출부는 그대로 양의 limit 을 넘기면
// 기존과 동일하게 MAX 로 상한이 걸린다.
const DEFAULT_SEARCH_RESULT_LIMIT = 20;
const MAX_SEARCH_RESULT_LIMIT = 200;

export interface SearchEquipmentResult {
  items: EquipmentCatalogItem[];
  /** 이 검색어에 실제로 매칭되는 전체 건수(= limit 적용 전). items.length 보다 크면 화면에서 잘렸다는 뜻이다. */
  total: number;
}

/** PostgREST `.or()` 필터 문자열에 그대로 끼워 넣을 값이라, 필터 문법을
 *  깨뜨리거나 의도치 않게 조건을 조작할 수 있는 문자(쉼표=조건 구분자,
 *  괄호=조건 그룹핑, 따옴표/역슬래시=값 이스케이프, %/_=LIKE 와일드카드)를
 *  제거한다. 장비 브랜드/모델명에 실질적으로 필요 없는 문자들이라 안전하게
 *  걸러내도 검색 품질에 영향이 없다. */
function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[,()"'\\%_]/g, " ").trim();
}

/** 공백을 전부 제거하고 소문자로 통일한 비교용 키 — "스쿠버 프로"(검색어)와
 *  "스쿠버프로"(저장값), 또는 그 반대(저장값에 공백이 있고 검색어에는 없는
 *  경우, 예: "곰 후드" ↔ "곰후드")를 모두 같은 값으로 취급하기 위함. */
function stripWhitespace(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

/**
 * Postgres ILIKE 패턴에서 (공백 제거한) 검색어의 글자 하나하나 사이에 `%`를
 * 끼워 넣은 "느슨한" 패턴을 만든다 — 예: "곰후드" → "%곰%후%드%". 이러면
 * 글자 사이에 공백이든 다른 글자든 뭐가 오든 일단 걸려든다. ILIKE는 컬럼
 * 값 자체의 공백을 제거하고 비교할 수 없으므로(PostgREST 필터는 컬럼을
 * 그대로 비교할 뿐 표현식을 계산하지 못함), 이 느슨한 패턴으로 DB에서
 * 후보를 넓게 추린 뒤 matchesIgnoringWhitespace 로 정확히 다시 거른다.
 */
function buildLooseIlikePattern(query: string): string {
  const chars = Array.from(stripWhitespace(query));
  return chars.length > 0 ? `%${chars.join("%")}%` : "%";
}

/** brand/category/name 중 하나라도 공백을 무시했을 때 검색어를 포함하면 매칭으로 본다. */
function matchesIgnoringWhitespace(
  row: { brand: string; category: string; name: string },
  noSpaceQuery: string
): boolean {
  return (
    stripWhitespace(row.brand).includes(noSpaceQuery) ||
    stripWhitespace(row.category).includes(noSpaceQuery) ||
    stripWhitespace(row.name).includes(noSpaceQuery)
  );
}

/**
 * 검색 결과 정렬 우선순위: ① 최근 사용 일시(last_used_at) 내림차순(최근
 * 사용한 적 없으면 맨 뒤) → ② 수동 등록/수정(is_custom=true) 우선 → ③
 * 브랜드/품명 가나다순. "자주 쓰는 품목이 검색할 때마다 상단에 뜬다"는
 * 요구를 그대로 정렬 키로 옮긴 것이다.
 */
function compareBySearchPriority(
  a: { last_used_at?: string | null; is_custom?: boolean; brand: string; name: string },
  b: { last_used_at?: string | null; is_custom?: boolean; brand: string; name: string }
): number {
  const aUsed = a.last_used_at ? Date.parse(a.last_used_at) : 0;
  const bUsed = b.last_used_at ? Date.parse(b.last_used_at) : 0;
  if (aUsed !== bUsed) return bUsed - aUsed;

  const aCustom = a.is_custom ? 1 : 0;
  const bCustom = b.is_custom ? 1 : 0;
  if (aCustom !== bCustom) return bCustom - aCustom;

  return a.brand.localeCompare(b.brand, "ko") || a.name.localeCompare(b.name, "ko");
}

export async function searchEquipment(
  rawQuery: string,
  limit: number = DEFAULT_SEARCH_RESULT_LIMIT,
  /** true면 품절(is_sold_out=true) 품목도 결과에 포함한다 — "장비 목록(수정/
   *  삭제)" 관리자 화면처럼 품절 품목도 확인/관리할 수 있어야 하는 곳에서만
   *  켠다. 견적서 작성 화면의 키워드 검색은 기본값(false)을 그대로 써서
   *  품절 품목이 선택지로 나오지 않는다. */
  includeSoldOut: boolean = false
): Promise<SearchEquipmentResult> {
  const query = sanitizeSearchQuery(rawQuery);
  if (!query) return { items: [], total: 0 };

  // limit<=0 은 "전체 결과"를 의미한다 — 양수일 때만 기존처럼 상한을 건다.
  const unlimited = limit <= 0;
  const cappedLimit = Math.min(
    Math.max(1, Math.trunc(limit) || DEFAULT_SEARCH_RESULT_LIMIT),
    MAX_SEARCH_RESULT_LIMIT
  );

  if (isMockMode()) {
    const noSpaceQuery = stripWhitespace(query);
    const matched = mockStore.equipment
      .filter((e) => (includeSoldOut || !e.is_sold_out) && matchesIgnoringWhitespace(e, noSpaceQuery))
      .sort(compareBySearchPriority);
    return {
      items: (unlimited ? matched : matched.slice(0, cappedLimit)).map((e) => ({
        id: e.id,
        brand: e.brand,
        category: e.category,
        name: e.name,
        price_retail: e.price_retail,
        colors: e.colors,
        sizes: e.sizes,
        override_discount_rate: e.override_discount_rate ?? null,
        image_url: e.image_url ?? null,
        is_sold_out: e.is_sold_out ?? false,
        price_instructor: e.price_instructor ?? null,
        price_center: e.price_center ?? null,
        price_center_overridden: e.price_center_overridden ?? false,
        price_cost: e.price_cost ?? null,
      })),
      total: matched.length,
    };
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  interface EquipmentSearchRow {
    id: string;
    brand: string;
    category: string;
    name: string;
    price_retail: number | string;
    colors: string[] | null;
    sizes: string[] | null;
    override_discount_rate: number | string | null;
    image_url: string | null;
    is_sold_out: boolean | null;
    price_instructor: number | string | null;
    price_center: number | string | null;
    price_center_overridden: boolean | null;
    price_cost: number | string | null;
  }

  // ILIKE는 컬럼 값 자체의 공백을 제거하고 비교하지 못하므로, 글자 사이에
  // 무엇이 오든 걸리는 느슨한 패턴으로 DB에서 후보를 넓게 추린다("곰후드"로
  // 검색해도 "곰 후드"가 걸리도록). 이 느슨한 패턴은 오탐(글자 순서만 맞고
  // 실제로는 공백 무시 비교에 실패하는 값)을 포함할 수 있어, 전량을 받아
  // matchesIgnoringWhitespace 로 다시 정확히 거른 뒤에야 최종 개수/페이지를
  // 확정한다 — 그래서 limit 이 있어도 항상 전량(fetchAllPages)을 먼저 가져온다.
  const noSpaceQuery = stripWhitespace(query);
  const loosePattern = buildLooseIlikePattern(query);
  const orFilter = [
    `brand.ilike.${loosePattern}`,
    `category.ilike.${loosePattern}`,
    `name.ilike.${loosePattern}`,
  ].join(",");

  const buildQuery = (from: number, to: number) => {
    let q = supabase
      .from("equipment")
      .select(
        "id, brand, category, name, price_retail, colors, sizes, override_discount_rate, image_url, is_sold_out, price_instructor, price_center, price_center_overridden, price_cost",
        { count: "exact" }
      )
      .or(orFilter);
    if (!includeSoldOut) q = q.eq("is_sold_out", false);
    return q
      // 최근 사용 우선 → 수동 등록/수정 우선 → 브랜드/품명 가나다순.
      // (nullsFirst: false 로, 한 번도 안 쓴 품목을 맨 뒤로 보낸다.)
      .order("last_used_at", { ascending: false, nullsFirst: false })
      .order("is_custom", { ascending: false })
      .order("brand", { ascending: true })
      .order("name", { ascending: true })
      .range(from, to);
  };

  const candidates = await fetchAllPages<EquipmentSearchRow>(buildQuery);
  const filtered = candidates.filter((row) => matchesIgnoringWhitespace(row, noSpaceQuery));
  const total = filtered.length;
  const rows = unlimited ? filtered : filtered.slice(0, cappedLimit);

  const items = rows.map((row) => ({
    id: row.id,
    brand: row.brand,
    category: row.category,
    name: row.name,
    price_retail: Number(row.price_retail),
    colors: row.colors ?? [],
    sizes: row.sizes ?? [],
    override_discount_rate:
      row.override_discount_rate == null ? null : Number(row.override_discount_rate),
    image_url: row.image_url ?? null,
    is_sold_out: row.is_sold_out ?? false,
    price_instructor: row.price_instructor == null ? null : Number(row.price_instructor),
    price_center: row.price_center == null ? null : Number(row.price_center),
    price_center_overridden: Boolean(row.price_center_overridden),
    price_cost: row.price_cost == null ? null : Number(row.price_cost),
  }));

  return { items, total };
}

// ── 단건 INSERT ───────────────────────────────────────────────────────────────

export interface InsertEquipmentData {
  brand: string;
  category: string;
  name: string;
  price_retail: number;
  colors: string[];
  sizes: string[];
  catalog_year: number | null;
  /** 품목별 예외 할인율(%, 0~100). null이면 브랜드 기본 할인율을 그대로 쓴다. */
  override_discount_rate: number | null;
  /** 원가(COST 등급). 관리자가 직접 입력하는 값 — 자동 동기화가 절대 안
   *  건드리므로 이 타입을 쓰는 insertEquipment/updateEquipment 에서만 바뀐다.
   *  생략하면(undefined) 기존 값을 그대로 둔다(updateEquipment)/null로
   *  시작한다(insertEquipment). */
  price_cost?: number | null;
}

/**
 * 이 함수는 "직접 등록" 화면(사람이 손으로 입력)에서만 호출된다 — 자동
 * 동기화(upsertEquipmentMultiBrand)와 경로가 완전히 분리돼 있어, 여기로
 * 들어오는 품목은 항상 is_custom=true 로 저장한다. 클라이언트가 이 값을 직접 보내게
 * 하지 않고 서버에서 무조건 강제하는 이유는, 이 플래그가 사용자 편집 여부를
 * 나타내는 무결성 플래그이지 사용자가 켜고 끌 수 있는 옵션이 아니기 때문이다.
 */
export async function insertEquipment(data: InsertEquipmentData): Promise<{ id: string }> {
  const normalized: InsertEquipmentData = { ...data, brand: normalizeBrand(data.brand) };

  if (isMockMode()) {
    const existing = mockStore.equipment.find(
      (e) =>
        e.brand === normalized.brand &&
        e.catalog_year === normalized.catalog_year &&
        e.name === normalized.name
    );
    if (existing) {
      const err = new Error("Duplicate") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    const now = new Date().toISOString();
    const newItem = {
      ...normalized,
      id: crypto.randomUUID(),
      is_custom: true,
      is_sold_out: false,
      created_at: now,
      updated_at: now,
    };
    mockStore.equipment.push(newItem);
    return { id: newItem.id };
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data: row, error } = await supabase
    .from("equipment")
    .insert({ ...normalized, is_custom: true, is_sold_out: false })
    .select("id")
    .single();
  if (error) throw error;
  return { id: row.id as string };
}

// ── 단건 조회 (수정 화면 초기값용) ───────────────────────────────────────────

export interface EquipmentDetail extends InsertEquipmentData {
  id: string;
}

export async function getEquipmentById(id: string): Promise<EquipmentDetail | null> {
  if (isMockMode()) {
    const row = mockStore.equipment.find((e) => e.id === id);
    if (!row) return null;
    return {
      id: row.id,
      brand: row.brand,
      category: row.category,
      name: row.name,
      price_retail: row.price_retail,
      colors: row.colors,
      sizes: row.sizes,
      catalog_year: row.catalog_year,
      override_discount_rate: row.override_discount_rate ?? null,
      price_cost: row.price_cost ?? null,
    };
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data: row, error } = await supabase
    .from("equipment")
    .select(
      "id, brand, category, name, price_retail, colors, sizes, catalog_year, override_discount_rate, price_cost"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  return {
    id: row.id as string,
    brand: row.brand as string,
    category: row.category as string,
    name: row.name as string,
    price_retail: Number(row.price_retail),
    colors: (row.colors as string[] | null) ?? [],
    sizes: (row.sizes as string[] | null) ?? [],
    catalog_year: row.catalog_year as number | null,
    override_discount_rate:
      row.override_discount_rate == null ? null : Number(row.override_discount_rate),
    price_cost: row.price_cost == null ? null : Number(row.price_cost as number | string | null),
  };
}

// ── 단건 수정 ─────────────────────────────────────────────────────────────────
// insertEquipment 과 동일하게 브랜드명은 항상 normalizeBrand() 를 거쳐 저장한다
// (수정 화면에서 브랜드를 다른 표기로 바꿔도 크롤러가 만든 정규화 규칙과
// 어긋나지 않도록).

/**
 * "장비 목록(수정/삭제)" 화면에서 사람이 직접 고칠 때만 호출된다 —
 * insertEquipment 와 동일한 이유로 is_custom=true 를 서버에서 강제한다.
 * 자동 동기화가 나중에 같은 브랜드+연도+모델명으로 다시 들어와도, 이
 * 플래그 덕분에 방금 수동으로 고친 값을 덮어쓰지 않는다.
 */
export async function updateEquipment(
  id: string,
  data: InsertEquipmentData
): Promise<void> {
  const normalized: InsertEquipmentData = { ...data, brand: normalizeBrand(data.brand) };

  if (isMockMode()) {
    const row = mockStore.equipment.find((e) => e.id === id);
    if (!row) {
      const err = new Error("장비를 찾을 수 없습니다.") as Error & { code?: string };
      err.code = "NOT_FOUND";
      throw err;
    }
    const duplicate = mockStore.equipment.find(
      (e) =>
        e.id !== id &&
        e.brand === normalized.brand &&
        e.catalog_year === normalized.catalog_year &&
        e.name === normalized.name
    );
    if (duplicate) {
      const err = new Error("Duplicate") as Error & { code: string };
      err.code = "23505";
      throw err;
    }
    // 수동 저장은 관리자가 이 품목을 직접 확인/반영한 것이므로, 대기 중이던
    // "확인 필요" 상태와 품절 상태도 함께 해제한다 — is_custom=true가 되는
    // 순간부터 reconcileSoldOutStatus(자동 동기화)는 보호 품목을 건드리지
    // 않으므로, 여기서 풀어주지 않으면 품절 표시가 영영 안 풀리는 품목이
    // 생긴다.
    Object.assign(row, normalized, {
      is_custom: true,
      pending_review_price: null,
      pending_review_detected_at: null,
      is_sold_out: false,
      updated_at: new Date().toISOString(),
    });
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("equipment")
    .update({
      ...normalized,
      is_custom: true,
      pending_review_price: null,
      pending_review_detected_at: null,
      is_sold_out: false,
    })
    .eq("id", id);
  if (error) throw error;
}

// ── 가격 변동 검토: 선택 품목만 가격 반영 ────────────────────────────────────────
// 동기화 결과의 "가격 변동 확인 필요" 탭에서 관리자가 "퐁당가 반영"을 선택한
// 품목만 price_retail 을 갱신한다. updateEquipment()와 달리 브랜드/카테고리/
// 색상/사이즈 등 다른 필드는 건드리지 않고(모를 수도 있음), is_custom 플래그도
// 그대로 유지한다 — 다음 동기화에서도 여전히 "보호 품목"으로 남아 자동 덮어쓰기
// 대상이 되지 않는다(이번에 가격만 수동으로 최신화했을 뿐).

/** @returns 실제로 가격이 갱신된 장비 id 목록 (존재하지 않는 id는 조용히 건너뛴다). */
export async function updateEquipmentPriceBulk(
  updates: { id: string; price: number }[]
): Promise<string[]> {
  if (updates.length === 0) return [];

  if (isMockMode()) {
    const now = new Date().toISOString();
    const updatedIds: string[] = [];
    for (const { id, price } of updates) {
      const row = mockStore.equipment.find((e) => e.id === id);
      if (!row) continue;
      row.price_retail = sanitizePriceRetail(price);
      // 가격을 반영했으니 "확인 필요" 대기 상태도 함께 해제한다.
      row.pending_review_price = null;
      row.pending_review_detected_at = null;
      row.updated_at = now;
      updatedIds.push(id);
    }
    return updatedIds;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const updatedIds: string[] = [];
  for (const { id, price } of updates) {
    const { error, count } = await supabase
      .from("equipment")
      .update(
        {
          price_retail: sanitizePriceRetail(price),
          pending_review_price: null,
          pending_review_detected_at: null,
        },
        { count: "exact" }
      )
      .eq("id", id);
    if (error) throw error;
    if ((count ?? 0) > 0) updatedIds.push(id);
  }
  return updatedIds;
}

// ── 공급가(CENTER 등급) 단건 수동 고정/해제 ──────────────────────────────────────
// "장비 목록" 화면의 공급가 인라인 입력칸 전용. updateEquipment()와 달리
// is_custom 을 건드리지 않는다 — 공급가 하나만 보호하고 싶을 뿐, 품목 전체를
// 보호(자동 동기화 전면 중단) 상태로 만들고 싶은 건 아니기 때문이다. 색상/
// 사이즈/소비자가/샵가는 계속 평소대로 자동 동기화된다.

/**
 * value 가 숫자면 공급가를 그 값으로 고정하고(price_center_overridden=true),
 * null 이면 "자동 계산으로 되돌리기" — price_center_overridden 을 false로
 * 풀어 다음 동기화 때 샵가 기준으로 다시 자동 계산되게 한다(이번 호출에서는
 * price_center 자체를 건드리지 않으며, 다음 동기화가 채워줄 때까지 기존
 * 값이 화면에 남아있을 수 있다).
 */
export async function updateEquipmentPriceCenter(
  id: string,
  value: number | null
): Promise<void> {
  if (isMockMode()) {
    const row = mockStore.equipment.find((e) => e.id === id);
    if (!row) {
      const err = new Error("장비를 찾을 수 없습니다.") as Error & { code?: string };
      err.code = "NOT_FOUND";
      throw err;
    }
    if (value == null) {
      row.price_center_overridden = false;
    } else {
      row.price_center = sanitizePriceRetail(value);
      row.price_center_overridden = true;
    }
    row.updated_at = new Date().toISOString();
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const payload =
    value == null
      ? { price_center_overridden: false }
      : { price_center: sanitizePriceRetail(value), price_center_overridden: true };
  const { error, count } = await supabase
    .from("equipment")
    .update(payload, { count: "exact" })
    .eq("id", id);
  if (error) throw error;
  if ((count ?? 0) === 0) {
    const err = new Error("장비를 찾을 수 없습니다.") as Error & { code?: string };
    err.code = "NOT_FOUND";
    throw err;
  }
}

// ── 가격 변동 검토: "현재가 유지"(확인 완료, 가격은 그대로) ───────────────────────
// "확인 필요 품목" 탭에서 "현재가 유지"를 누르면 price_retail 은 건드리지
// 않고 pending_review_* 만 비워 대기 목록에서 빼준다.

/** @returns 실제로 대기 상태가 해제된 장비 id 목록. */
export async function dismissPendingReview(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];

  if (isMockMode()) {
    const now = new Date().toISOString();
    const dismissedIds: string[] = [];
    for (const id of ids) {
      const row = mockStore.equipment.find((e) => e.id === id);
      if (!row) continue;
      row.pending_review_price = null;
      row.pending_review_detected_at = null;
      row.updated_at = now;
      dismissedIds.push(id);
    }
    return dismissedIds;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const dismissedIds: string[] = [];
  for (const id of ids) {
    const { error, count } = await supabase
      .from("equipment")
      .update(
        { pending_review_price: null, pending_review_detected_at: null },
        { count: "exact" }
      )
      .eq("id", id);
    if (error) throw error;
    if ((count ?? 0) > 0) dismissedIds.push(id);
  }
  return dismissedIds;
}

// ── "확인 필요 품목" 목록 조회 ────────────────────────────────────────────────
// 동기화 세션이 끝나도 사라지지 않는, pending_review_price 가 채워진 모든
// 보호 품목을 모아 보여준다("확인 필요 품목" 탭의 데이터 소스).

export async function getPendingReviewEquipment(): Promise<PendingReviewEquipmentItem[]> {
  if (isMockMode()) {
    return mockStore.equipment
      .filter((e) => e.pending_review_price != null)
      .map((e) => ({
        id: e.id,
        brand: e.brand,
        category: e.category,
        name: e.name,
        currentPrice: e.price_retail,
        newPrice: e.pending_review_price as number,
        detectedAt: e.pending_review_detected_at ?? e.updated_at,
        image_url: e.image_url ?? null,
      }))
      .sort((a, b) => Date.parse(b.detectedAt) - Date.parse(a.detectedAt));
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, brand, category, name, price_retail, pending_review_price, pending_review_detected_at, image_url")
    .not("pending_review_price", "is", null)
    .order("pending_review_detected_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    brand: row.brand as string,
    category: row.category as string,
    name: row.name as string,
    currentPrice: Number(row.price_retail),
    newPrice: Number(row.pending_review_price),
    detectedAt: (row.pending_review_detected_at as string | null) ?? new Date().toISOString(),
    image_url: (row.image_url as string | null) ?? null,
  }));
}

/** "확인 필요 품목" 건수만 가볍게 센다(상단 탭/현황 카드의 빨간 뱃지용). */
export async function getPendingReviewCount(): Promise<number> {
  if (isMockMode()) {
    return mockStore.equipment.filter((e) => e.pending_review_price != null).length;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { count, error } = await supabase
    .from("equipment")
    .select("id", { count: "exact", head: true })
    .not("pending_review_price", "is", null);
  if (error) throw error;
  return count ?? 0;
}

// ── 단건 삭제 ─────────────────────────────────────────────────────────────────
// equipment_items.equipment_id 는 "on delete set null" 로 걸려 있어(초기
// 마이그레이션 참고), 이미 저장된 견적서가 이 장비를 참조 중이어도 삭제가
// 막히지 않는다 — 해당 견적서의 항목은 이후 "(삭제된 장비)" 로 표시된다
// (estimate-repo.ts 의 name: eq?.name ?? "(삭제된 장비)" 폴백 참고). 단가/수량
// 등 견적 당시 스냅샷 값은 estimate_items 자체에 저장돼 있어 그대로 유지된다.

export async function deleteEquipment(id: string): Promise<boolean> {
  if (isMockMode()) {
    const idx = mockStore.equipment.findIndex((e) => e.id === id);
    if (idx === -1) return false;
    mockStore.equipment.splice(idx, 1);
    return true;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error, count } = await supabase
    .from("equipment")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// ── 벌크 UPSERT(여러 브랜드 한 번에) ──────────────────────────────────────────
// 퐁당닷컴처럼 한 번의 크롤링 결과에 수십~수백 개 브랜드가 섞여 있는 경우,
// 브랜드 1개를 전제로 한 upsert를 브랜드별로 루프 돌리면 브랜드 수만큼
// Supabase 왕복(보호 품목 조회 1번 + upsert 1번)이 생긴다 — 실측 결과 200개
// 안팎의 브랜드가 섞인 크롤링 조각 하나에서만 이 왕복이 수십~백여 번
// 발생해 Netlify 서버 함수 실행 시간 제한을 넘기는 주된 원인이었다(페이지
// 크롤링 자체보다 이 부분이 더 오래 걸렸다). 이 함수는 브랜드가 몇 개
// 섞여 있든 조회 1번 + upsert 1번, 총 2번의 왕복으로 끝낸다.
/**
 * 상세페이지 옵션 보완 후보((브랜드,품명) 키 목록) 중, 이번 조각(chunk)에서
 * 실제로 상세페이지를 열어볼 N건을 고른다 — option_checked_at이 없거나
 * (한 번도 확인된 적 없음) 가장 오래된 품목부터 우선순위를 둔다.
 *
 * 예전에는 "그 조각에서 가장 먼저 발견된 N건"을 그대로 골랐는데, 목록
 * 페이지 크롤링 순서가 날마다 거의 그대로라 매일 똑같은 품목만 반복
 * 보완되고 나머지는 차례가 오지 않는 문제가 실측으로 확인됐다(동일한
 * 전체 동기화를 하루에 두 번 돌려도 보완 후보 수가 거의 줄지 않음).
 * option_checked_at 기준으로 우선순위를 두면 매번 다른 품목이 돌아가며
 * 보완되어, 결국 전체 카탈로그가 전수 보완에 도달한다.
 *
 * 보호(is_custom=true) 품목은 애초에 후보에서 제외한다 — 자동 동기화가
 * 보호 품목의 색상/사이즈를 저장하지 않으므로, 상세페이지를 열어봐도
 * 결과가 버려져 조각의 보완 예산만 낭비하게 된다.
 */
export async function selectEnrichmentCandidates(
  catalogYear: number,
  candidateKeys: { brand: string; name: string }[],
  limit: number
): Promise<Set<string>> {
  const keyOf = (brand: string, name: string) => `${brand}\u0000${name}`;
  if (candidateKeys.length === 0 || limit <= 0) return new Set();

  const candidateKeySet = new Set(candidateKeys.map((k) => keyOf(k.brand, k.name)));
  const checkedAtByKey = new Map<string, string | null>();

  if (isMockMode()) {
    for (const e of mockStore.equipment) {
      if (e.catalog_year !== catalogYear || e.is_custom) continue;
      const key = keyOf(e.brand, e.name);
      if (candidateKeySet.has(key)) checkedAtByKey.set(key, e.option_checked_at ?? null);
    }
  } else {
    const { createAdminClient } = await import("@/lib/supabase/server");
    const supabase = await createAdminClient();
    const distinctBrands = Array.from(new Set(candidateKeys.map((k) => k.brand)));

    try {
      const { data, error } = await supabase
        .from("equipment")
        .select("brand, name, option_checked_at, is_custom")
        .eq("catalog_year", catalogYear)
        .in("brand", distinctBrands);
      if (error) throw error;
      for (const r of data ?? []) {
        if (r.is_custom) continue;
        const key = keyOf(r.brand as string, r.name as string);
        if (candidateKeySet.has(key)) {
          checkedAtByKey.set(key, (r.option_checked_at as string | null) ?? null);
        }
      }
    } catch {
      // 조회 실패해도 전체를 "한 번도 확인 안 됨"으로 간주하고 계속
      // 진행한다 — 보완 자체를 아예 건너뛰는 것보다 낫다.
    }
  }

  const prioritized = Array.from(candidateKeySet)
    .map((key) => ({ key, checkedAt: checkedAtByKey.get(key) ?? "" }))
    .sort((a, b) => a.checkedAt.localeCompare(b.checkedAt));

  return new Set(prioritized.slice(0, limit).map((e) => e.key));
}

/**
 * selectEnrichmentCandidates 로 고른 품목들의 상세페이지를 실제로 열어봤다는
 * 사실을(결과적으로 옵션이 그대로였어도) option_checked_at 에 기록해,
 * 다음 번 동기화에서는 우선순위가 뒤로 밀리도록 한다.
 */
export async function markOptionsChecked(
  catalogYear: number,
  checkedKeys: Set<string>
): Promise<void> {
  if (checkedKeys.size === 0) return;
  const now = new Date().toISOString();

  if (isMockMode()) {
    for (const e of mockStore.equipment) {
      if (e.catalog_year !== catalogYear) continue;
      if (checkedKeys.has(`${e.brand}\u0000${e.name}`)) {
        e.option_checked_at = now;
      }
    }
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  for (const key of checkedKeys) {
    const [brand, name] = key.split("\u0000");
    try {
      const { error } = await supabase
        .from("equipment")
        .update({ option_checked_at: now })
        .eq("catalog_year", catalogYear)
        .eq("brand", brand)
        .eq("name", name);
      if (error) throw error;
    } catch (error) {
      // 이 기록은 다음 번 보완 우선순위를 위한 부가 정보일 뿐이라, 실패해도
      // 동기화 자체(이미 끝난 upsert)는 영향받지 않게 조용히 넘어간다.
      console.error("option_checked_at 갱신 실패:", error);
    }
  }
}

export async function upsertEquipmentMultiBrand(
  catalogYear: number,
  rawItems: (ParsedEquipmentItem & { brand: string; price_instructor: number | null })[]
): Promise<UpsertBulkResult> {
  if (rawItems.length === 0) {
    return { insertedCount: 0, updatedCount: 0, protectedCount: 0, failedCount: 0, items: [] };
  }

  const items = rawItems.map((item) => ({
    ...item,
    brand: normalizeBrand(item.brand),
    price_retail: sanitizePriceRetail(item.price_retail),
  }));

  const keyOf = (brand: string, name: string) => `${brand}\u0000${name}`;

  if (isMockMode()) {
    const now = new Date().toISOString();
    const results: EquipmentImportItemResult[] = [];

    for (const item of items) {
      const idx = mockStore.equipment.findIndex(
        (e) => e.brand === item.brand && e.catalog_year === catalogYear && e.name === item.name
      );
      if (idx >= 0 && mockStore.equipment[idx].is_custom) {
        const existing = mockStore.equipment[idx];
        // 보호 품목도 이미지가 아예 없었다면만 새로 찾은 썸네일을 채운다
        // (가격 등 다른 필드는 그대로 유지).
        if (!existing.image_url && item.image_url) {
          existing.image_url = item.image_url;
          existing.updated_at = now;
        }
        // 가격이 실제로 다르면 "확인 필요" 상태로 남겨둔다(즉시 반영하지
        // 않음). 이전에 감지된 가격이 이번엔 현재가와 같아졌다면(예: 이미
        // 수동으로 맞춰졌거나 퐁당가가 되돌아간 경우) 대기 상태를 해제한다.
        if (item.price_retail !== existing.price_retail) {
          existing.pending_review_price = item.price_retail;
          existing.pending_review_detected_at = now;
        } else if (existing.pending_review_price != null) {
          existing.pending_review_price = null;
          existing.pending_review_detected_at = null;
        }
        results.push({
          brand: item.brand,
          name: item.name,
          category: item.category,
          status: "protected",
          id: existing.id,
          oldPrice: existing.price_retail,
          newPrice: item.price_retail,
        });
      } else if (idx >= 0) {
        const existing = mockStore.equipment[idx];
        // 샵가는 로그인 성공한 조각에서만 채워진다(null이면 이번 동기화에서
        // 수집 안 됨 — 기존 값을 그대로 둔다). 공급가는 관리자가 직접
        // 고정(price_center_overridden)하지 않았을 때만 샵가 기준으로
        // 재계산한다.
        const priceInstructor = item.price_instructor ?? existing.price_instructor ?? null;
        const priceCenter =
          existing.price_center_overridden
            ? existing.price_center
            : item.price_instructor != null
              ? computePriceCenter(item.price_retail, item.price_instructor)
              : existing.price_center ?? null;
        mockStore.equipment[idx] = {
          ...existing,
          category: item.category,
          price_retail: item.price_retail,
          price_instructor: priceInstructor,
          price_center: priceCenter,
          colors: item.colors,
          sizes: item.sizes,
          image_url: item.image_url ?? existing.image_url ?? null,
          // 이번 동기화에서 다시 발견됐으니 품절 상태였다면 즉시 해제한다.
          is_sold_out: false,
          updated_at: now,
        };
        results.push({ brand: item.brand, name: item.name, category: item.category, status: "updated" });
      } else {
        mockStore.equipment.push({
          id: crypto.randomUUID(),
          brand: item.brand,
          catalog_year: catalogYear,
          category: item.category,
          name: item.name,
          price_retail: item.price_retail,
          price_instructor: item.price_instructor ?? null,
          price_center: item.price_instructor != null ? computePriceCenter(item.price_retail, item.price_instructor) : null,
          price_center_overridden: false,
          price_cost: null,
          colors: item.colors,
          sizes: item.sizes,
          image_url: item.image_url ?? null,
          is_sold_out: false,
          created_at: now,
          updated_at: now,
        });
        results.push({ brand: item.brand, name: item.name, category: item.category, status: "inserted" });
      }
    }

    const insertedCount = results.filter((r) => r.status === "inserted").length;
    const updatedCount = results.filter((r) => r.status === "updated").length;
    const protectedCount = results.filter((r) => r.status === "protected").length;
    return { insertedCount, updatedCount, protectedCount, failedCount: 0, items: results };
  }

  // ── 실제 Supabase ──
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const distinctBrands = Array.from(new Set(items.map((item) => item.brand)));

  let existingByKey: Map<
    string,
    {
      id: string;
      is_custom: boolean;
      price_retail: number;
      image_url: string | null;
      pending_review_price: number | null;
      price_instructor: number | null;
      price_center: number | null;
      price_center_overridden: boolean;
    }
  >;
  try {
    const { data, error } = await supabase
      .from("equipment")
      .select(
        "id, brand, name, is_custom, price_retail, image_url, pending_review_price, price_instructor, price_center, price_center_overridden"
      )
      .eq("catalog_year", catalogYear)
      .in("brand", distinctBrands);
    if (error) throw error;
    existingByKey = new Map(
      (data ?? []).map((r) => [
        keyOf(r.brand as string, r.name as string),
        {
          id: r.id as string,
          is_custom: Boolean(r.is_custom),
          price_retail: Number(r.price_retail),
          image_url: (r.image_url as string | null) ?? null,
          pending_review_price:
            r.pending_review_price == null ? null : Number(r.pending_review_price),
          price_instructor: r.price_instructor == null ? null : Number(r.price_instructor),
          price_center: r.price_center == null ? null : Number(r.price_center),
          price_center_overridden: Boolean(r.price_center_overridden),
        },
      ])
    );
  } catch {
    existingByKey = new Map();
  }

  const protectedItems = items.filter(
    (item) => existingByKey.get(keyOf(item.brand, item.name))?.is_custom === true
  );
  const itemsToUpsert = items.filter(
    (item) => existingByKey.get(keyOf(item.brand, item.name))?.is_custom !== true
  );

  const rows = itemsToUpsert.map((item) => {
    const existing = existingByKey.get(keyOf(item.brand, item.name));
    // 샵가는 로그인 성공한 조각에서만 채워진다(null이면 이번 동기화에서
    // 수집 안 됨 — 기존 값을 그대로 보존). 공급가는 관리자가
    // price_center_overridden 으로 직접 고정하지 않았을 때만 샵가 기준으로
    // 재계산한다 — 두 컬럼 다 payload 에 명시적으로 넣어야(onConflict
    // merge-duplicates는 포함된 컬럼만 덮어씀) 기존 값이 안 날아간다.
    const priceInstructor = item.price_instructor ?? existing?.price_instructor ?? null;
    const priceCenter = existing?.price_center_overridden
      ? existing.price_center
      : item.price_instructor != null
        ? computePriceCenter(item.price_retail, item.price_instructor)
        : (existing?.price_center ?? null);

    return {
      brand: item.brand,
      catalog_year: catalogYear,
      category: item.category,
      name: item.name,
      price_retail: item.price_retail,
      price_instructor: priceInstructor,
      price_center: priceCenter,
      colors: item.colors,
      sizes: item.sizes,
      image_url: item.image_url ?? null,
      // 이번 동기화에서 다시 발견된 품목이니 품절 상태였다면 즉시 해제한다
      // (reconcileSoldOutStatus 는 "더 이상 안 보이는" 쪽만 처리하므로, 다시
      // 보이는 쪽은 여기서 바로 풀어줘야 한다).
      is_sold_out: false,
    };
  });

  try {
    if (rows.length > 0) {
      const { error } = await supabase
        .from("equipment")
        .upsert(rows, { onConflict: "brand,catalog_year,name" });
      if (error) throw error;
    }

    // 보호 품목(is_custom)은 가격/카테고리/색상·사이즈 본문은 절대 덮어쓰지
    // 않지만, (a) 이미지가 아예 없던 품목이면 새로 찾은 썸네일만 채워 넣고,
    // (b) 가격이 실제로 다르면 즉시 반영하는 대신 pending_review_* 에
    // "확인 필요" 상태로 남겨 "확인 필요 품목" 탭에서 다룰 수 있게 한다
    // (이전에 감지된 대기 상태가 이번엔 현재가와 같아졌다면 해제한다).
    // 건수가 보통 적어 id 단위로 개별 update 해도 충분하다.
    const now = new Date().toISOString();
    for (const item of protectedItems) {
      const existing = existingByKey.get(keyOf(item.brand, item.name));
      if (!existing) continue;

      const updatePayload: Record<string, unknown> = {};

      if (!existing.image_url && item.image_url) {
        updatePayload.image_url = item.image_url;
      }

      if (item.price_retail !== existing.price_retail) {
        updatePayload.pending_review_price = item.price_retail;
        updatePayload.pending_review_detected_at = now;
      } else if (existing.pending_review_price != null) {
        updatePayload.pending_review_price = null;
        updatePayload.pending_review_detected_at = null;
      }

      if (Object.keys(updatePayload).length === 0) continue;

      const { error } = await supabase
        .from("equipment")
        .update(updatePayload)
        .eq("id", existing.id);
      if (error) throw error;
    }

    const results: EquipmentImportItemResult[] = [
      ...itemsToUpsert.map((item) => ({
        brand: item.brand,
        name: item.name,
        category: item.category,
        status: (existingByKey.has(keyOf(item.brand, item.name))
          ? "updated"
          : "inserted") as EquipmentImportItemStatus,
      })),
      ...protectedItems.map((item) => {
        const existing = existingByKey.get(keyOf(item.brand, item.name));
        return {
          brand: item.brand,
          name: item.name,
          category: item.category,
          status: "protected" as EquipmentImportItemStatus,
          message: "수동으로 등록/수정된 품목이라 자동 동기화에서 건너뛰었습니다.",
          id: existing?.id,
          oldPrice: existing?.price_retail,
          newPrice: item.price_retail,
        };
      }),
    ];

    return {
      insertedCount: results.filter((r) => r.status === "inserted").length,
      updatedCount: results.filter((r) => r.status === "updated").length,
      protectedCount: results.filter((r) => r.status === "protected").length,
      failedCount: 0,
      items: results,
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "알 수 없는 오류";
    console.error("장비 벌크 upsert(다중 브랜드) 실패:", error);
    const results: EquipmentImportItemResult[] = itemsToUpsert.map((item) => ({
      brand: item.brand,
      name: item.name,
      category: item.category,
      status: "failed",
      message: `저장 실패: ${message}`,
    }));
    return {
      insertedCount: 0,
      updatedCount: 0,
      protectedCount: 0,
      failedCount: results.length,
      items: results,
    };
  }
}

// ── 품절/재입고 상태 반영 ──────────────────────────────────────────────────────
// 전체 동기화(모든 카테고리 × 모든 페이지)가 끝난 뒤 한 번만 호출된다 —
// upsertEquipmentMultiBrand() 는 조각(카테고리+페이지 범위) 하나만 보므로
// "이번 조각에 없다"는 걸 "품절됐다"로 바로 단정할 수 없다(아직 안 가져온
// 페이지에 있을 수도 있으니). 전체가 끝난 시점에 "이번 동기화에서 한 번이라도
// 발견된 (브랜드,품명) 키 전체"와 "DB에 이미 있는 자동 동기화 품목(is_custom
// =false) 전체"를 비교해서:
//   - DB에는 있는데 이번에 하나도 안 보인 품목 → 품절(is_sold_out=true)
//   - 품절(true) 이었는데 이번엔 다시 보인 품목 → 재입고(false)로 복원
//     (이 경우는 보통 upsertEquipmentMultiBrand 에서 이미 false로 바뀌어
//     있지만, seenKeys 기준으로 한 번 더 확인해 혹시 놓친 경우까지 보정한다)
// 보호(is_custom=true) 품목은 사람이 직접 관리하는 행이라 대상에서 제외한다
// (자동 동기화로 발견 못 해도 영원히 보호 상태를 유지한다).

export interface ReconcileSoldOutResult {
  soldOutCount: number;
  restoredCount: number;
  /** 임시 디버그 필드(원인 조사용) — 원인 확인 후 제거 예정. */
  debugTotalRows?: number;
  debugSeenSize?: number;
  debugSampleUnmatched?: { brand: string; name: string; isSoldOut: boolean }[];
}

export async function reconcileSoldOutStatus(
  catalogYear: number,
  seenKeys: { brand: string; name: string }[]
): Promise<ReconcileSoldOutResult> {
  const seen = new Set(seenKeys.map((k) => `${normalizeBrand(k.brand)}\u0000${k.name}`));

  if (isMockMode()) {
    let soldOutCount = 0;
    let restoredCount = 0;
    const now = new Date().toISOString();
    for (const row of mockStore.equipment) {
      if (row.catalog_year !== catalogYear || row.is_custom) continue;
      const key = `${row.brand}\u0000${row.name}`;
      const isSeen = seen.has(key);
      if (!isSeen && !row.is_sold_out) {
        row.is_sold_out = true;
        row.updated_at = now;
        soldOutCount += 1;
      } else if (isSeen && row.is_sold_out) {
        row.is_sold_out = false;
        row.updated_at = now;
        restoredCount += 1;
      }
    }
    return { soldOutCount, restoredCount };
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  // range() 페이지네이션 없이 그냥 select 하면 Supabase 기본 상한(요청당
  // 최대 1000행)에 걸려 나머지 품목은 조용히 빠진 채 "품절로 안 보임"으로
  // 처리된다 — 장비가 1000건을 훌쩍 넘는 지금 규모에서는 fetchAllPages 로
  // 전량을 가져와야 한다(다른 대형 조회들과 동일 패턴).
  const data = await fetchAllPages<{
    id: string;
    brand: string;
    name: string;
    is_sold_out: boolean | null;
  }>((from, to) =>
    supabase
      .from("equipment")
      .select("id, brand, name, is_sold_out", { count: "exact" })
      .eq("catalog_year", catalogYear)
      .eq("is_custom", false)
      .range(from, to)
  );

  const toSoldOut: string[] = [];
  const toRestore: string[] = [];
  const debugSampleUnmatched: { brand: string; name: string; isSoldOut: boolean }[] = [];
  for (const row of data ?? []) {
    const key = `${row.brand as string}\u0000${row.name as string}`;
    const isSeen = seen.has(key);
    const isSoldOut = Boolean(row.is_sold_out);
    if ((row.name as string).includes("땡처리") && debugSampleUnmatched.length < 10) {
      debugSampleUnmatched.push({
        brand: `${row.brand as string}|key=${key}|isSeen=${isSeen}`,
        name: row.name as string,
        isSoldOut,
      });
    }
    if (!isSeen && !isSoldOut) toSoldOut.push(row.id as string);
    else if (isSeen && isSoldOut) toRestore.push(row.id as string);
  }

  // id 목록 하나당 update 1번(총 최대 2번)으로 끝낸다 — 건당 UPDATE 를 수천 번
  // 반복하면 품목 수만큼 왕복이 생겨 15분 백그라운드 함수 시간 예산을
  // 갉아먹는다(upsertEquipmentMultiBrand 가 브랜드별 루프를 없앤 것과 같은 이유).
  if (toSoldOut.length > 0) {
    const { error: soldOutError } = await supabase
      .from("equipment")
      .update({ is_sold_out: true })
      .in("id", toSoldOut);
    if (soldOutError) throw soldOutError;
  }
  if (toRestore.length > 0) {
    const { error: restoreError } = await supabase
      .from("equipment")
      .update({ is_sold_out: false })
      .in("id", toRestore);
    if (restoreError) throw restoreError;
  }

  return {
    soldOutCount: toSoldOut.length,
    restoredCount: toRestore.length,
    debugTotalRows: data.length,
    debugSeenSize: seen.size,
    debugSampleUnmatched,
  };
}

// ── 동기화 실행 이력(sync_runs) ──────────────────────────────────────────────
// "데이터 동기화 현황" 카드가 보여줄 최신 동기화 일시/건수/상태 메시지를
// 남긴다. 퐁당닷컴 동기화는 카테고리×페이지 단위로 나뉘어 호출되므로(client
// 쪽 usePongdangChunkedSync 참고), 조각마다가 아니라 전체가 끝난 시점(성공/
// 실패 모두)에 이 함수가 1번만 호출된다.

export interface CreateSyncRunInput {
  source: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "error";
  totalParsed: number;
  insertedCount: number;
  updatedCount: number;
  protectedCount: number;
  failedCount: number;
  distinctBrandCount: number;
  distinctCategoryCount: number;
  soldOutCount: number;
  restoredCount: number;
  message: string | null;
}

function toSyncRunRecord(row: {
  id: string;
  source: string;
  started_at: string;
  finished_at: string;
  status: string;
  total_parsed: number;
  inserted_count: number;
  updated_count: number;
  protected_count: number;
  failed_count: number;
  distinct_brand_count: number;
  distinct_category_count: number;
  sold_out_count: number;
  restored_count: number;
  message: string | null;
}): SyncRunRecord {
  return {
    id: row.id,
    source: row.source,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    status: row.status === "error" ? "error" : "success",
    totalParsed: row.total_parsed,
    insertedCount: row.inserted_count,
    updatedCount: row.updated_count,
    protectedCount: row.protected_count,
    failedCount: row.failed_count,
    distinctBrandCount: row.distinct_brand_count,
    distinctCategoryCount: row.distinct_category_count,
    soldOutCount: row.sold_out_count,
    restoredCount: row.restored_count,
    message: row.message,
  };
}

export async function createSyncRun(input: CreateSyncRunInput): Promise<void> {
  if (isMockMode()) {
    const now = new Date().toISOString();
    mockStore.syncRuns.unshift({
      id: crypto.randomUUID(),
      source: input.source,
      started_at: input.startedAt,
      finished_at: input.finishedAt,
      status: input.status,
      total_parsed: input.totalParsed,
      inserted_count: input.insertedCount,
      updated_count: input.updatedCount,
      protected_count: input.protectedCount,
      failed_count: input.failedCount,
      distinct_brand_count: input.distinctBrandCount,
      distinct_category_count: input.distinctCategoryCount,
      sold_out_count: input.soldOutCount,
      restored_count: input.restoredCount,
      message: input.message,
      created_at: now,
    });
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error } = await supabase.from("sync_runs").insert({
    source: input.source,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    status: input.status,
    total_parsed: input.totalParsed,
    inserted_count: input.insertedCount,
    updated_count: input.updatedCount,
    protected_count: input.protectedCount,
    failed_count: input.failedCount,
    distinct_brand_count: input.distinctBrandCount,
    distinct_category_count: input.distinctCategoryCount,
    sold_out_count: input.soldOutCount,
    restored_count: input.restoredCount,
    message: input.message,
  });
  if (error) throw error;
}

export async function getLatestSyncRun(): Promise<SyncRunRecord | null> {
  const runs = await getRecentSyncRuns(1);
  return runs[0] ?? null;
}

export async function getRecentSyncRuns(limit: number): Promise<SyncRunRecord[]> {
  if (isMockMode()) {
    return mockStore.syncRuns.slice(0, limit).map((r) =>
      toSyncRunRecord({
        id: r.id,
        source: r.source,
        started_at: r.started_at,
        finished_at: r.finished_at,
        status: r.status,
        total_parsed: r.total_parsed,
        inserted_count: r.inserted_count,
        updated_count: r.updated_count,
        protected_count: r.protected_count,
        failed_count: r.failed_count,
        distinct_brand_count: r.distinct_brand_count,
        distinct_category_count: r.distinct_category_count,
        sold_out_count: r.sold_out_count,
        restored_count: r.restored_count,
        message: r.message,
      })
    );
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("sync_runs")
    .select(
      "id, source, started_at, finished_at, status, total_parsed, inserted_count, updated_count, protected_count, failed_count, distinct_brand_count, distinct_category_count, sold_out_count, restored_count, message"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) =>
    toSyncRunRecord(
      row as {
        id: string;
        source: string;
        started_at: string;
        finished_at: string;
        status: string;
        total_parsed: number;
        inserted_count: number;
        updated_count: number;
        protected_count: number;
        failed_count: number;
        distinct_brand_count: number;
        distinct_category_count: number;
        sold_out_count: number;
        restored_count: number;
        message: string | null;
      }
    )
  );
}
