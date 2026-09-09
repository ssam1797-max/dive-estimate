import { getDiscountPolicyBrands } from "@/lib/db/discount-policy-repo";
import { EquipmentImportForm } from "@/components/equipment/equipment-import-form";
import { CatalogSyncPanel } from "@/components/equipment/catalog-sync-panel";

export const metadata = { title: "장비 카탈로그 업로드" };
export const dynamic = "force-dynamic";

export default async function EquipmentImportPage() {
  let brands: string[] = [];
  let loadError = false;

  try {
    brands = await getDiscountPolicyBrands();
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-8">
      <CatalogSyncPanel />

      <div className="flex flex-col gap-4 border-t pt-8">
        <p className="text-sm text-muted-foreground">
          브랜드 카탈로그 PDF를 업로드하면 AI가 장비 목록(종류/모델명/가격/색상/사이즈)을
          자동으로 추출해서 장비 마스터에 등록합니다. 이미 등록된 브랜드·연도·모델명이
          있으면 자동으로 갱신됩니다.
        </p>
        <EquipmentImportForm initialBrands={brands} brandsLoadError={loadError} />
      </div>
    </div>
  );
}
