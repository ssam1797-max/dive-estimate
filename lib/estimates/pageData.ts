import "server-only";
import { getAllEquipment } from "@/lib/db/equipment-repo";
import { getDiscountPolicyMap } from "@/lib/db/discount-policy-repo";
import { getProfilesByType, getProfileById } from "@/lib/db/profile-repo";
import type { EquipmentCatalogItem, ProfileOption } from "@/lib/estimates/types";
import type { DiscountPolicyMap } from "@/lib/estimates/pricing";

export async function getEquipmentCatalog(): Promise<EquipmentCatalogItem[]> {
  try {
    return await getAllEquipment();
  } catch (error) {
    console.error("장비 카탈로그 조회 실패:", error);
    throw new Error("장비 목록을 불러오지 못했습니다.");
  }
}

export async function getProfilesByType2(
  type: "PROVIDER" | "RECEIVER"
): Promise<ProfileOption[]> {
  try {
    return await getProfilesByType(type);
  } catch (error) {
    console.error("프로필 조회 실패:", error);
    throw new Error("프로필 목록을 불러오지 못했습니다.");
  }
}

// 기존 호출부 시그니처 유지
export { getProfilesByType, getProfileById };

export async function getDiscountPolicyMap2(): Promise<DiscountPolicyMap> {
  try {
    return await getDiscountPolicyMap();
  } catch (error) {
    console.error("할인율 정책 조회 실패:", error);
    throw new Error("할인율 정책을 불러오지 못했습니다.");
  }
}

export { getDiscountPolicyMap };
