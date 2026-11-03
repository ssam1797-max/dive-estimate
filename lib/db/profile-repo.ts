import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";
import type { ProfileOption } from "@/lib/estimates/types";

function toProfileOption(r: {
  id: string;
  name: string;
  contact: string | null;
  address: string | null;
  stamp_url: string | null;
  business_number?: string | null;
  representative?: string | null;
  business_type?: string | null;
  business_category?: string | null;
  email?: string | null;
  fax?: string | null;
}): ProfileOption {
  return {
    id: r.id,
    name: r.name,
    contact: r.contact,
    address: r.address,
    stampUrl: r.stamp_url,
    businessNumber: r.business_number ?? null,
    representative: r.representative ?? null,
    businessType: r.business_type ?? null,
    businessCategory: r.business_category ?? null,
    email: r.email ?? null,
    fax: r.fax ?? null,
  };
}

export async function getProfilesByType(
  type: "PROVIDER" | "RECEIVER"
): Promise<ProfileOption[]> {
  if (isMockMode()) {
    return mockStore.profiles
      .filter((p) => p.type === type)
      .map(toProfileOption);
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email, fax"
    )
    .eq("type", type)
    .order("name");
  if (error) throw error;
  return ((data ?? []) as Parameters<typeof toProfileOption>[0][]).map(toProfileOption);
}

export async function getProfileById(id: string): Promise<ProfileOption | null> {
  if (isMockMode()) {
    const p = mockStore.profiles.find((p) => p.id === id);
    return p ? toProfileOption(p) : null;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email, fax"
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toProfileOption(data as Parameters<typeof toProfileOption>[0]) : null;
}

export interface ProfileInputData {
  type: "PROVIDER" | "RECEIVER";
  name: string;
  contact: string;
  address: string;
  stampUrl: string;
  businessNumber: string;
  representative: string;
  businessType: string;
  businessCategory: string;
  email: string;
  fax: string;
}

/** 빈 문자열은 "값 없음"을 뜻하는 null 로 정규화해서 저장한다 (기존 필드들과 동일한 규칙). */
function toNullableRow(input: ProfileInputData) {
  const orNull = (v: string) => (v.trim() ? v.trim() : null);
  return {
    type: input.type,
    name: input.name.trim(),
    contact: orNull(input.contact),
    address: orNull(input.address),
    stamp_url: orNull(input.stampUrl),
    business_number: orNull(input.businessNumber),
    representative: orNull(input.representative),
    business_type: orNull(input.businessType),
    business_category: orNull(input.businessCategory),
    email: orNull(input.email),
    fax: orNull(input.fax),
  };
}

export async function createProfile(input: ProfileInputData): Promise<ProfileOption> {
  const row = toNullableRow(input);

  if (isMockMode()) {
    const newProfile = { id: crypto.randomUUID(), ...row };
    mockStore.profiles.push(newProfile);
    return toProfileOption(newProfile);
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .insert(row)
    .select("id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email, fax")
    .single();
  if (error) throw error;
  return toProfileOption(data as Parameters<typeof toProfileOption>[0]);
}

export async function updateProfile(
  id: string,
  input: ProfileInputData
): Promise<ProfileOption | null> {
  const row = toNullableRow(input);

  if (isMockMode()) {
    const idx = mockStore.profiles.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    mockStore.profiles[idx] = { ...mockStore.profiles[idx], ...row };
    return toProfileOption(mockStore.profiles[idx]);
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .update(row)
    .eq("id", id)
    .select("id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email, fax")
    .maybeSingle();
  if (error) throw error;
  return data ? toProfileOption(data as Parameters<typeof toProfileOption>[0]) : null;
}

/** 견적서가 참조 중이라 삭제할 수 없는 프로필. message 를 화면에 그대로 보여준다. */
export class ProfileInUseError extends Error {}

/** Postgres 외래 키 위반 코드 — estimates 가 ON DELETE RESTRICT 로 프로필을 참조한다. */
const FOREIGN_KEY_VIOLATION = "23503";

export async function deleteProfile(id: string): Promise<void> {
  if (isMockMode()) {
    const idx = mockStore.profiles.findIndex((p) => p.id === id);
    if (idx >= 0) mockStore.profiles.splice(idx, 1);
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error?.code === FOREIGN_KEY_VIOLATION) {
    // 여기까지 왔다면 id 는 DB 가 받아들인 유효한 uuid 다.
    const { data, count } = await supabase
      .from("estimates")
      .select("estimate_number", { count: "exact" })
      .or(`provider_id.eq.${id},receiver_id.eq.${id}`)
      .order("date", { ascending: false })
      .limit(3);
    const numbers = (data ?? []).map((row) => row.estimate_number).filter(Boolean);
    const extra = (count ?? numbers.length) - numbers.length;
    const list = numbers.join(", ") + (extra > 0 ? ` 외 ${extra}건` : "");
    throw new ProfileInUseError(
      numbers.length > 0
        ? `견적서 ${list}에서 사용 중이라 삭제할 수 없습니다. 해당 견적서를 먼저 삭제해주세요.`
        : "견적서에서 사용 중이라 삭제할 수 없습니다. 해당 견적서를 먼저 삭제해주세요."
    );
  }
  if (error) throw error;
}
