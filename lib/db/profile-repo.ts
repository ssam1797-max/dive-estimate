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
      "id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email"
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
      "id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email"
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
    .select("id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email")
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
    .select("id, name, contact, address, stamp_url, business_number, representative, business_type, business_category, email")
    .maybeSingle();
  if (error) throw error;
  return data ? toProfileOption(data as Parameters<typeof toProfileOption>[0]) : null;
}

export async function deleteProfile(id: string): Promise<void> {
  if (isMockMode()) {
    const idx = mockStore.profiles.findIndex((p) => p.id === id);
    if (idx >= 0) mockStore.profiles.splice(idx, 1);
    return;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error } = await supabase.from("profiles").delete().eq("id", id);
  if (error) throw error;
}
