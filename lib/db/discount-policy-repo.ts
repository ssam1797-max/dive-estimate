import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";
import { buildDiscountPolicyMap, type DiscountPolicyMap } from "@/lib/estimates/pricing";
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
  /** 사용자가 "브랜드 할인율 설정" 화면에서 직접 저장했으면 true. */
  is_custom: boolean;
}

// ── 전체 목록 ──────────────────────────────────────────────────────────────────

export async function getAllDiscountPolicies(): Promise<DiscountPolicy[]> {
  if (isMockMode()) {
    // 이 필드가 추가되기 전에 이미 메모리에 생성된 항목(서버 재시작 없이 HMR로
    // 살아남은 인스턴스)을 위해 aliases 가 없을 때 빈 배열로 방어한다.
    return mockStore.discountPolicies.map((p) => ({
      ...p,
      aliases: p.aliases ?? [],
      is_custom: p.is_custom ?? false,
    }));
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
    is_custom: boolean | null;
  }>((from, to) =>
    supabase
      .from("discount_policies")
      .select(
        "id, brand, aliases, rate_retail, rate_instructor, rate_center, rate_cost, is_custom",
        { count: "exact" }
      )
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
    is_custom: r.is_custom ?? false,
  }));
}

// ── 맵 (견적서 가격 계산용) ───────────────────────────────────────────────────

export async function getDiscountPolicyMap(): Promise<DiscountPolicyMap> {
  const list = await getAllDiscountPolicies();
  return buildDiscountPolicyMap(list);
}

// ── 브랜드 목록 (정책이 있는 브랜드만) ───────────────────────────────────────

export async function getDiscountPolicyBrands(): Promise<string[]> {
  if (isMockMode()) {
    return mockStore.discountPolicies.map((p) => p.brand).sort();
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const rows = await fetchAllPages<{ brand: string }>((from, to) =>
    supabase
      .from("discount_policies")
      .select("brand", { count: "exact" })
      .order("brand")
      .range(from, to)
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

/**
 * isCustom: true 로 호출하면 사람이 "브랜드 할인율 설정" 화면에서 직접
 * 저장한 것으로 간주해 is_custom=true 를 강제로 써넣는다("직접 등록"
 * 화면이 항상 is_custom=true 를 강제하는 equipment-repo.ts 의
 * insertEquipment/updateEquipment 와 같은 패턴).
 */
export async function upsertDiscountPolicy(
  rawInput: UpsertDiscountPolicyInput,
  options: { isCustom?: boolean } = {}
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
        is_custom: options.isCustom ? true : (mockStore.discountPolicies[idx].is_custom ?? false),
        updated_at: now,
      };
      return { ...mockStore.discountPolicies[idx], is_custom: mockStore.discountPolicies[idx].is_custom ?? false };
    }
    const created = {
      id: crypto.randomUUID(),
      ...input,
      aliases,
      is_custom: options.isCustom ?? false,
      created_at: now,
      updated_at: now,
    };
    mockStore.discountPolicies.push(created);
    return { ...created };
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const payload: Record<string, unknown> = { ...input, aliases };
  if (options.isCustom) {
    payload.is_custom = true;
  }
  const { data, error } = await supabase
    .from("discount_policies")
    .upsert(payload, { onConflict: "brand" })
    .select("id, brand, aliases, rate_retail, rate_instructor, rate_center, rate_cost, is_custom")
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
    is_custom: Boolean(data.is_custom),
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
