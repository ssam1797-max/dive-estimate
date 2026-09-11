import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";
import type { EquipmentCatalogItem } from "@/lib/estimates/types";
import type { ParsedEquipmentItem, EquipmentImportItemResult } from "@/lib/equipment/types";
import { normalizeBrand } from "@/lib/equipment/normalizeBrand";
import { fetchAllPages } from "@/lib/db/paginate";

export interface UpsertBulkResult {
  insertedCount: number;
  updatedCount: number;
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
    return mockStore.equipment.map((e) => ({
      id: e.id,
      brand: e.brand,
      category: e.category,
      name: e.name,
      price_retail: e.price_retail,
      colors: e.colors,
      sizes: e.sizes,
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
    }>((from, to) =>
      supabase
        .from("equipment")
        .select("id, brand, category, name, price_retail, colors, sizes", { count: "exact" })
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
const SEARCH_RESULT_LIMIT = 20;

/** PostgREST `.or()` 필터 문자열에 그대로 끼워 넣을 값이라, 필터 문법을
 *  깨뜨리거나 의도치 않게 조건을 조작할 수 있는 문자(쉼표=조건 구분자,
 *  괄호=조건 그룹핑, 따옴표/역슬래시=값 이스케이프, %/_=LIKE 와일드카드)를
 *  제거한다. 장비 브랜드/모델명에 실질적으로 필요 없는 문자들이라 안전하게
 *  걸러내도 검색 품질에 영향이 없다. */
function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[,()"'\\%_]/g, " ").trim();
}

export async function searchEquipment(rawQuery: string): Promise<EquipmentCatalogItem[]> {
  const query = sanitizeSearchQuery(rawQuery);
  if (!query) return [];

  if (isMockMode()) {
    const lower = query.toLowerCase();
    return mockStore.equipment
      .filter(
        (e) =>
          e.brand.toLowerCase().includes(lower) ||
          e.category.toLowerCase().includes(lower) ||
          e.name.toLowerCase().includes(lower)
      )
      .slice(0, SEARCH_RESULT_LIMIT)
      .map((e) => ({
        id: e.id,
        brand: e.brand,
        category: e.category,
        name: e.name,
        price_retail: e.price_retail,
        colors: e.colors,
        sizes: e.sizes,
      }));
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("equipment")
    .select("id, brand, category, name, price_retail, colors, sizes")
    .or(`brand.ilike.%${query}%,category.ilike.%${query}%,name.ilike.%${query}%`)
    .order("brand")
    .order("name")
    .limit(SEARCH_RESULT_LIMIT);
  if (error) throw error;

  return ((data ?? []) as {
    id: string;
    brand: string;
    category: string;
    name: string;
    price_retail: number | string;
    colors: string[] | null;
    sizes: string[] | null;
  }[]).map((row) => ({
    id: row.id,
    brand: row.brand,
    category: row.category,
    name: row.name,
    price_retail: Number(row.price_retail),
    colors: row.colors ?? [],
    sizes: row.sizes ?? [],
  }));
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
}

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
    const newItem = { ...normalized, id: crypto.randomUUID(), created_at: now, updated_at: now };
    mockStore.equipment.push(newItem);
    return { id: newItem.id };
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data: row, error } = await supabase
    .from("equipment")
    .insert(normalized)
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
    };
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data: row, error } = await supabase
    .from("equipment")
    .select("id, brand, category, name, price_retail, colors, sizes, catalog_year")
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
  };
}

// ── 단건 수정 ─────────────────────────────────────────────────────────────────
// insertEquipment 과 동일하게 브랜드명은 항상 normalizeBrand() 를 거쳐 저장한다
// (수정 화면에서 브랜드를 다른 표기로 바꿔도 크롤러가 만든 정규화 규칙과
// 어긋나지 않도록).

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
    Object.assign(row, normalized, { updated_at: new Date().toISOString() });
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error } = await supabase.from("equipment").update(normalized).eq("id", id);
  if (error) throw error;
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

// ── 벌크 UPSERT (PDF 업로드용) ───────────────────────────────────────────────

export async function upsertEquipmentBulk(
  rawBrand: string,
  catalogYear: number,
  rawItems: ParsedEquipmentItem[]
): Promise<UpsertBulkResult> {
  if (rawItems.length === 0) {
    return { insertedCount: 0, updatedCount: 0, failedCount: 0, items: [] };
  }

  const brand = normalizeBrand(rawBrand);
  const items = rawItems.map((item) => ({
    ...item,
    price_retail: sanitizePriceRetail(item.price_retail),
  }));

  if (isMockMode()) {
    const now = new Date().toISOString();
    const results: EquipmentImportItemResult[] = [];

    for (const item of items) {
      const idx = mockStore.equipment.findIndex(
        (e) => e.brand === brand && e.catalog_year === catalogYear && e.name === item.name
      );
      if (idx >= 0) {
        mockStore.equipment[idx] = {
          ...mockStore.equipment[idx],
          category: item.category,
          price_retail: item.price_retail,
          colors: item.colors,
          sizes: item.sizes,
          updated_at: now,
        };
        results.push({ name: item.name, category: item.category, status: "updated" });
      } else {
        mockStore.equipment.push({
          id: crypto.randomUUID(),
          brand,
          catalog_year: catalogYear,
          category: item.category,
          name: item.name,
          price_retail: item.price_retail,
          colors: item.colors,
          sizes: item.sizes,
          created_at: now,
          updated_at: now,
        });
        results.push({ name: item.name, category: item.category, status: "inserted" });
      }
    }

    const insertedCount = results.filter((r) => r.status === "inserted").length;
    const updatedCount = results.filter((r) => r.status === "updated").length;
    return { insertedCount, updatedCount, failedCount: 0, items: results };
  }

  // ── 실제 Supabase ──
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  let existingNames: Set<string>;
  try {
    const { data, error } = await supabase
      .from("equipment")
      .select("name")
      .eq("brand", brand)
      .eq("catalog_year", catalogYear);
    if (error) throw error;
    existingNames = new Set((data ?? []).map((r) => r.name as string));
  } catch {
    existingNames = new Set();
  }

  const rows = items.map((item) => ({
    brand,
    catalog_year: catalogYear,
    category: item.category,
    name: item.name,
    price_retail: item.price_retail,
    colors: item.colors,
    sizes: item.sizes,
  }));

  try {
    const { error } = await supabase
      .from("equipment")
      .upsert(rows, { onConflict: "brand,catalog_year,name" });
    if (error) throw error;

    const results: EquipmentImportItemResult[] = items.map((item) => ({
      name: item.name,
      category: item.category,
      status: existingNames.has(item.name) ? "updated" : "inserted",
    }));

    return {
      insertedCount: results.filter((r) => r.status === "inserted").length,
      updatedCount: results.filter((r) => r.status === "updated").length,
      failedCount: 0,
      items: results,
    };
  } catch (error) {
    // Supabase 의 PostgrestError 는 Error 를 상속하지 않는 일반 객체라
    // `error instanceof Error` 만으로는 메시지를 놓친다. `.message` 필드를 우선
    // 확인해 실제 원인(DNS 실패, RLS 거부, 제약조건 위반 등)이 그대로 드러나게 한다.
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "알 수 없는 오류";
    console.error("장비 벌크 upsert 실패:", error);
    const results: EquipmentImportItemResult[] = items.map((item) => ({
      name: item.name,
      category: item.category,
      status: "failed",
      message: `저장 실패: ${message}`,
    }));
    return { insertedCount: 0, updatedCount: 0, failedCount: results.length, items: results };
  }
}
