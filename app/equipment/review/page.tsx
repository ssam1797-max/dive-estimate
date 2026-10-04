import { getEquipmentBrands, getPendingReviewEquipment } from "@/lib/db/equipment-repo";
import { PendingReviewManager } from "@/components/equipment/pending-review-manager";

export const metadata = { title: "확인 필요 품목" };
export const dynamic = "force-dynamic";

export default async function EquipmentReviewPage() {
  let items: Awaited<ReturnType<typeof getPendingReviewEquipment>> = [];
  let brands: string[] = [];
  let loadError = false;

  try {
    [items, brands] = await Promise.all([getPendingReviewEquipment(), getEquipmentBrands()]);
  } catch {
    loadError = true;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        수동으로 등록/수정해(보호 중인) 가격이 퐁당닷컴 최신가와 달라진 품목만 모았습니다.
        최신가를 반영하거나 현재 가격을 유지하면 목록에서 빠지고, 직접 수정해도 확인
        완료로 처리됩니다.
      </p>
      {loadError ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          확인 필요 품목을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </p>
      ) : (
        <PendingReviewManager items={items} initialBrands={brands} />
      )}
    </div>
  );
}
