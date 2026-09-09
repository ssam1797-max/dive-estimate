import { getEquipmentBrands } from "@/lib/db/equipment-repo";
import { getDiscountPolicyBrands } from "@/lib/db/discount-policy-repo";
import { EquipmentManualForm } from "@/components/equipment/equipment-manual-form";

export const metadata = { title: "장비 직접 등록" };
export const dynamic = "force-dynamic";

export default async function EquipmentNewPage() {
  let brands: string[] = [];
  let loadError = false;

  try {
    const [eqBrands, policyBrands] = await Promise.all([
      getEquipmentBrands(),
      getDiscountPolicyBrands(),
    ]);
    brands = [...new Set([...eqBrands, ...policyBrands])].sort();
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        장비 정보를 직접 입력하여 장비 마스터에 등록합니다. 같은 브랜드·연도·모델명이 이미
        있다면 중복 오류가 안내됩니다.
      </p>
      <EquipmentManualForm initialBrands={brands} brandsLoadError={loadError} />
    </div>
  );
}
