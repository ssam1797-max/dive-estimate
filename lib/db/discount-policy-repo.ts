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
  /** 사용자가 "브랜드 할인율 설정" 화면에서 직접 저장했으면 true — 퐁당닷컴 동기화가 덮어쓰지 않는다. */
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
 *
 * 자동 동기화(퐁당닷컴)는 이 옵션 없이 호출한다 — payload 에 is_custom
 * 키 자체를 넣지 않으면, upsert 의 ON CONFLICT DO UPDATE 가 기존 값을
 * 그대로 두고(신규 삽입일 때만 컬럼 기본값 false 가 적용된다), 자동
 * 동기화가 실수로 보호 플래그를 되돌리는 일이 없다.
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
