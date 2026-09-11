import { getEquipmentBrands } from "@/lib/db/equipment-repo";
import { EquipmentListManager } from "@/components/equipment/equipment-list-manager";

export const metadata = { title: "장비 목록" };
export const dynamic = "force-dynamic";

export default async function EquipmentListPage() {
  let brands: string[] = [];
  let loadError = false;

  try {
    brands = await getEquipmentBrands();
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        등록된 장비를 브랜드·카테고리·모델명으로 검색해서 정보를 수정하거나 삭제합니다.
        이미 저장된 견적서에서 사용 중인 장비도 삭제할 수 있으며, 삭제된 장비는 해당
        견적서에 &quot;(삭제된 장비)&quot;로 표시됩니다.
      </p>
      <EquipmentListManager initialBrands={brands} brandsLoadError={loadError} />
    </div>
  );
}
