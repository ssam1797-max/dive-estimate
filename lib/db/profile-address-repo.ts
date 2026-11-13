import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";
import type { ProfileAddressInput } from "@/lib/estimates/schema";
import type { ProfileAddress } from "@/lib/estimates/types";

/**
 * 공급받는자 주소록(profile_addresses) 저장소.
 * profile-repo.ts 와 같은 규칙 — Mock 모드면 인메모리, 아니면 admin 클라이언트.
 */

const SELECT_COLUMNS = "id, profile_id, label, recipient_name, contact, address, memo";

interface ProfileAddressRow {
  id: string;
  profile_id: string;
  label: string | null;
  recipient_name: string;
  contact: string | null;
  address: string;
  memo: string | null;
}

function toProfileAddress(row: ProfileAddressRow): ProfileAddress {
  return {
    id: row.id,
    profileId: row.profile_id,
    label: row.label,
    recipientName: row.recipient_name,
    contact: row.contact,
    address: row.address,
    memo: row.memo,
  };
}

/** 빈 문자열은 null 로 정규화한다(다른 저장소와 동일한 규칙). */
function toRow(input: ProfileAddressInput) {
  const orNull = (value: string) => (value.trim() ? value.trim() : null);
  return {
    label: orNull(input.label),
    recipient_name: input.recipientName.trim(),
    contact: orNull(input.contact),
    address: input.address.trim(),
    memo: orNull(input.memo),
  };
}

/** 주소록 대상 프로필이 없을 때. API 가 404 로 응답한다. */
export class ProfileNotFoundError extends Error {}

/** Postgres 외래 키 위반 — 존재하지 않는 profile_id 로 INSERT 한 경우. */
const FOREIGN_KEY_VIOLATION = "23503";
/** Postgres uuid 형식 오류 — 잘못된 id 가 URL 로 들어온 경우. */
const INVALID_TEXT_REPRESENTATION = "22P02";

export async function getAddressesByProfile(profileId: string): Promise<ProfileAddress[]> {
  if (isMockMode()) {
    return mockStore.profileAddresses
      .filter((row) => row.profile_id === profileId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map(toProfileAddress);
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("profile_addresses")
    .select(SELECT_COLUMNS)
    .eq("profile_id", profileId)
    .order("created_at", { ascending: true });
  if (error?.code === INVALID_TEXT_REPRESENTATION) return [];
  if (error) throw error;
  return ((data ?? []) as ProfileAddressRow[]).map(toProfileAddress);
}

export async function createProfileAddress(
  profileId: string,
  input: ProfileAddressInput
): Promise<ProfileAddress> {
  const row = { profile_id: profileId, ...toRow(input) };

  if (isMockMode()) {
    if (!mockStore.profiles.some((profile) => profile.id === profileId)) {
      throw new ProfileNotFoundError("공급받는자를 찾을 수 없습니다.");
    }
    const now = new Date().toISOString();
    const created = { id: crypto.randomUUID(), ...row, created_at: now, updated_at: now };
    mockStore.profileAddresses.push(created);
    return toProfileAddress(created);
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("profile_addresses")
    .insert(row)
    .select(SELECT_COLUMNS)
    .single();
  if (error?.code === FOREIGN_KEY_VIOLATION || error?.code === INVALID_TEXT_REPRESENTATION) {
    throw new ProfileNotFoundError("공급받는자를 찾을 수 없습니다.");
  }
  if (error) throw error;
  return toProfileAddress(data as ProfileAddressRow);
}

/** 수정 대상이 없으면(또는 다른 프로필의 배송지면) null. */
export async function updateProfileAddress(
  profileId: string,
  addressId: string,
  input: ProfileAddressInput
): Promise<ProfileAddress | null> {
  const row = toRow(input);

  if (isMockMode()) {
    const target = mockStore.profileAddresses.find(
      (item) => item.id === addressId && item.profile_id === profileId
    );
    if (!target) return null;
    Object.assign(target, row, { updated_at: new Date().toISOString() });
    return toProfileAddress(target);
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("profile_addresses")
    .update(row)
    .eq("id", addressId)
    .eq("profile_id", profileId)
    .select(SELECT_COLUMNS)
    .maybeSingle();
  if (error?.code === INVALID_TEXT_REPRESENTATION) return null;
  if (error) throw error;
  return data ? toProfileAddress(data as ProfileAddressRow) : null;
}

/** 삭제했으면 true, 대상이 없으면 false. */
export async function deleteProfileAddress(
  profileId: string,
  addressId: string
): Promise<boolean> {
  if (isMockMode()) {
    const index = mockStore.profileAddresses.findIndex(
      (item) => item.id === addressId && item.profile_id === profileId
    );
    if (index < 0) return false;
    mockStore.profileAddresses.splice(index, 1);
    return true;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error, count } = await supabase
    .from("profile_addresses")
    .delete({ count: "exact" })
    .eq("id", addressId)
    .eq("profile_id", profileId);
  if (error?.code === INVALID_TEXT_REPRESENTATION) return false;
  if (error) throw error;
  return (count ?? 0) > 0;
}
