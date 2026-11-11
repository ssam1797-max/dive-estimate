import { notFound } from "next/navigation";
import { getSavedEstimateDetail } from "@/lib/db/estimate-repo";
import { getEquipmentById } from "@/lib/db/equipment-repo";
import {
  EstimatePrintView,
  type EquipmentOptionsMap,
} from "@/components/estimates/estimate-print-view";
import { getIsAdmin } from "@/lib/auth/admin-session";
import { stripCostForViewer } from "@/lib/estimates/adminVisibility";
import type { SavedEstimateDetail } from "@/lib/estimates/types";

export const metadata = { title: "견적서 인쇄" };
export const dynamic = "force-dynamic";

/**
 * 관리자가 이 화면에서 품목 옵션(색상/사이즈)을 고칠 때 자동완성 후보로
 * 보여줄, 장비 마스터에 등록된 옵션 목록을 모은다. 어디까지나 입력 편의용
 * 이라, 조회에 실패하거나 장비가 삭제됐어도 화면 전체를 막지 않고 후보 없이
 * (직접 입력만 가능한 상태로) 계속 진행한다.
 */
async function loadEquipmentOptions(estimate: SavedEstimateDetail): Promise<EquipmentOptionsMap> {
  const equipmentIds = Array.from(
    new Set(
      estimate.items
        .map((item) => item.equipmentId)
        .filter((equipmentId): equipmentId is string => Boolean(equipmentId))
    )
  );

  const options: EquipmentOptionsMap = {};
  await Promise.all(
    equipmentIds.map(async (equipmentId) => {
      try {
        const equipment = await getEquipmentById(equipmentId);
        if (equipment) {
          options[equipmentId] = { colors: equipment.colors, sizes: equipment.sizes };
        }
      } catch (error) {
        console.error("옵션 후보 조회 실패:", equipmentId, error);
      }
    })
  );
  return options;
}

export default async function EstimatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [estimate, isAdmin] = await Promise.all([getSavedEstimateDetail(id), getIsAdmin()]);

  if (!estimate) notFound();

  const equipmentOptions = isAdmin ? await loadEquipmentOptions(estimate) : undefined;

  return (
    <EstimatePrintView
      estimate={stripCostForViewer(estimate, isAdmin)}
      isAdmin={isAdmin}
      equipmentOptions={equipmentOptions}
    />
  );
}
