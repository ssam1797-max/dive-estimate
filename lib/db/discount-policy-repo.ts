import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";
import type { DiscountPolicyMap } from "@/lib/estimates/pricing";
import { normalizeBrand } from "@/lib/equipment/normalizeBrand";
import { fetchAllPages } from "@/lib/db/paginate";

export interface DiscountPolicy {
  id: string;
  brand: string;
  /** 같은 할인율 정책을 적용할 다른 표기(한글 브랜드명, 대소문자 변형 등). */
  aliases: string[];
  rate_retail: number;
  rate_instructor: number;
  rate_center: number;
  rate_cost: number;
}

// ── 전체 목록 ──────────────────────────────────────────────────────────────────

export async function getAllDiscountPolicies(): Promise<DiscountPolicy[]> {
  if (isMockMode()) {
    // 이 필드가 추가되기 전에 이미 메모리에 생성된 항목(서버 재시작 없이 HMR로
    // 살아남은 인스턴스)을 위해 aliases 가 없을 때 빈 배열로 방어한다.
    return mockStore.discountPolicies.map((p) => ({ ...p, aliases: p.aliases ?? [] }));
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const rows = await fetchAllPages<{
    id: string;
    brand: string;
    aliases: string[] | null;
    rate_retail: number | string;
    rate_instructor: number | string;
    rate_center: number | string;
    rate_cost: number | string;
  }>((from, to) =>
    supabase
      .from("discount_policies")
      .select("id, brand, aliases, rate_retail, rate_instructor, rate_center, rate_cost")
      .order("brand")
      .range(from, to)
  );
  return rows.map((r) => ({
    id: r.id,
    brand: r.brand,
    aliases: r.aliases ?? [],
    rate_retail: Number(r.rate_retail),
    rate_instructor: Number(r.rate_instructor),
    rate_center: Number(r.rate_center),
    rate_cost: Number(r.rate_cost),
  }));
}

// ── 맵 (견적서 가격 계산용) ───────────────────────────────────────────────────

export async function getDiscountPolicyMap(): Promise<DiscountPolicyMap> {
  const list = await getAllDiscountPolicies();
  const map: DiscountPolicyMap = {};
  for (const p of list) {
    const rates = {
      rate_retail: p.rate_retail,
      rate_instructor: p.rate_instructor,
      rate_center: p.rate_center,
      rate_cost: p.rate_cost,
    };
    map[p.brand] = rates;
    // 별칭(다른 언어/표기의 브랜드명)도 같은 할인율을 가리키도록 등록한다.
    for (const alias of p.aliases) {
      const trimmed = alias.trim();
      if (trimmed) map[trimmed] = rates;
    }
  }
  return map;
}

/** 대소문자뿐 아니라 앞뒤/연속 공백 차이도 무시하고 비교하기 위한 키. */
function normalizeBrandKey(brand: string): string {
  return brand.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * 원본(크롤러가 수집한) 브랜드 문자열로 기존 정책을 찾는다. brand 필드 자체뿐
 * 아니라 별칭(aliases)도 확인해서, "마레스"로 조회해도 "Mares" 정책 행을
 * 찾아낸다 — 자동 동기화가 별칭이 등록된 브랜드에 중복 행을 만들지 않게 하기 위함.
 */
export async function findDiscountPolicyByBrandOrAlias(
  rawBrand: string
): Promise<DiscountPolicy | undefined> {
  const target = normalizeBrandKey(rawBrand);
  const list = await getAllDiscountPolicies();
  return list.find(
    (p) =>
      normalizeBrandKey(p.brand) === target ||
      p.aliases.some((alias) => normalizeBrandKey(alias) === target)
  );
}

// ── 브랜드 목록 (정책이 있는 브랜드만) ───────────────────────────────────────

export async function getDiscountPolicyBrands(): Promise<string[]> {
  if (isMockMode()) {
    return mockStore.discountPolicies.map((p) => p.brand).sort();
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const rows = await fetchAllPages<{ brand: string }>((from, to) =>
    supabase.from("discount_policies").select("brand").order("brand").range(from, to)
  );
  return rows.map((r) => r.brand);
}

// ── UPSERT ────────────────────────────────────────────────────────────────────

export interface UpsertDiscountPolicyInput {
  brand: string;
  aliases?: string[];
  rate_retail: number;
  rate_instructor: number;
  rate_center: number;
  rate_cost: number;
}

export async function upsertDiscountPolicy(
  rawInput: UpsertDiscountPolicyInput
): Promise<DiscountPolicy> {
  const aliases = (rawInput.aliases ?? []).map((a) => a.trim()).filter(Boolean);
  const input: UpsertDiscountPolicyInput = { ...rawInput, brand: normalizeBrand(rawInput.brand) };

  if (isMockMode()) {
    const now = new Date().toISOString();
    const idx = mockStore.discountPolicies.findIndex((p) => p.brand === input.brand);
    if (idx >= 0) {
      mockStore.discountPolicies[idx] = {
        ...mockStore.discountPolicies[idx],
        ...input,
        aliases,
        updated_at: now,
      };
      return { ...mockStore.discountPolicies[idx] };
    }
    const created = {
      id: crypto.randomUUID(),
      ...input,
      aliases,
      created_at: now,
      updated_at: now,
    };
    mockStore.discountPolicies.push(created);
    return { ...created };
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("discount_policies")
    .upsert({ ...input, aliases }, { onConflict: "brand" })
    .select("id, brand, aliases, rate_retail, rate_instructor, rate_center, rate_cost")
    .single();
  if (error) throw error;
  return {
    id: data.id as string,
    brand: data.brand as string,
    aliases: (data.aliases as string[] | null) ?? [],
    rate_retail: Number(data.rate_retail),
    rate_instructor: Number(data.rate_instructor),
    rate_center: Number(data.rate_center),
    rate_cost: Number(data.rate_cost),
  };
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function deleteDiscountPolicy(brand: string): Promise<void> {
  if (isMockMode()) {
    mockStore.discountPolicies = mockStore.discountPolicies.filter(
      (p) => p.brand !== brand
    );
    return;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error } = await supabase
    .from("discount_policies")
    .delete()
    .eq("brand", brand);
  if (error) throw error;
}
