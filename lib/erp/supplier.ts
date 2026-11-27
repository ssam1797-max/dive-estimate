import "server-only";
import { getProfilesByType } from "@/lib/db/profile-repo";
import type { ProfileOption } from "@/lib/estimates/types";

/**
 * 출력물에 찍을 공급자 프로필. ?supplier=<id> 로 고를 수 있고,
 * 고르지 않으면 경영박사 장부의 사업자인 씨유(SEAU)를, 없으면 첫 번째 공급자를 쓴다.
 */
export async function loadSuppliers(selectedId?: string): Promise<{
  suppliers: ProfileOption[];
  supplier: ProfileOption | null;
}> {
  let suppliers: ProfileOption[] = [];
  try {
    suppliers = await getProfilesByType("PROVIDER");
  } catch (e) {
    console.error("공급자 정보 조회 실패:", e);
  }
  const supplier =
    suppliers.find((s) => s.id === selectedId) ??
    suppliers.find((s) => /씨유|SEAU/i.test(s.name)) ??
    suppliers[0] ??
    null;
  return { suppliers, supplier };
}
