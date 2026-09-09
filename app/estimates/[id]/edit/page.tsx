import { notFound } from "next/navigation";
import {
  getEquipmentCatalog,
  getProfilesByType,
  getDiscountPolicyMap,
} from "@/lib/estimates/pageData";
import { listTemplateSummaries } from "@/lib/estimates/templateQueries";
import { getSavedEstimateDetail } from "@/lib/db/estimate-repo";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import type { EstimateItemDraft, SavedEstimateItemDetail } from "@/lib/estimates/types";
import type { PriceTier } from "@/lib/estimates/pricing";
import type { EstimateBuilderInitialData } from "@/hooks/use-estimate-builder";

export const metadata = { title: "견적서 수정" };
export const dynamic = "force-dynamic";

/**
 * 저장 시점 4개 등급 스냅샷 중 초기 선택 등급에 해당하는 값을 단가로 쓴다.
 * 이 기능이 추가되기 전에 저장된 견적서(스냅샷 전부 null)는 저장 당시의
 * 단일 unitPrice 로 폴백한다 — app/estimates/[id]/print 의 EstimatePrintView
 * 와 동일한 폴백 규칙.
 */
function tierPriceOf(item: SavedEstimateItemDetail, tier: PriceTier): number {
  const snapshot: Record<PriceTier, number | null> = {
    RETAIL: item.priceRetail,
    INSTRUCTOR: item.priceInstructor,
    CENTER: item.priceCenter,
    COST: item.priceCost,
  };
  return snapshot[tier] ?? item.unitPrice;
}

export default async function EditEstimatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let loadError: string | null = null;
  let catalog: Awaited<ReturnType<typeof getEquipmentCatalog>> = [];
  let providers: Awaited<ReturnType<typeof getProfilesByType>> = [];
  let receivers: Awaited<ReturnType<typeof getProfilesByType>> = [];
  let templates: Awaited<ReturnType<typeof listTemplateSummaries>> = [];
  let discountPolicies: Awaited<ReturnType<typeof getDiscountPolicyMap>> = {};
  let editContext: { estimateId: string; initialData: EstimateBuilderInitialData } | null = null;

  try {
    const [estimate, catalogData, providersData, receiversData, templatesData, discountPoliciesData] =
      await Promise.all([
        getSavedEstimateDetail(id),
        getEquipmentCatalog(),
        getProfilesByType("PROVIDER"),
        getProfilesByType("RECEIVER"),
        listTemplateSummaries(),
        getDiscountPolicyMap(),
      ]);

    if (!estimate) notFound();

    catalog = catalogData;
    providers = providersData;
    receivers = receiversData;
    templates = templatesData;
    discountPolicies = discountPoliciesData;

    const priceTier: PriceTier = estimate.priceTier ?? "RETAIL";

    const items: EstimateItemDraft[] = estimate.items.map((item) => ({
      clientId: crypto.randomUUID(),
      equipmentId: item.equipmentId ?? "",
      brand: item.brand,
      category: item.category,
      name: item.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      priceRetail: item.priceRetail ?? item.unitPrice,
      unitPrice: tierPriceOf(item, priceTier),
      itemRemarks: item.itemRemarks,
    }));

    editContext = {
      estimateId: estimate.id,
      initialData: {
        date: estimate.date,
        estimateNumber: estimate.estimateNumber,
        providerId: estimate.provider?.id ?? "",
        receiverId: estimate.receiver?.id ?? "",
        remarks: estimate.remarks,
        priceTier,
        items,
      },
    };
  } catch (error) {
    console.error("견적서 수정 화면 데이터 조회 실패:", error);
    loadError =
      error instanceof Error
        ? error.message
        : "화면에 필요한 데이터를 불러오지 못했습니다.";
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">견적서 수정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          저장되어 있던 견적서 내용을 불러왔습니다. 자유롭게 수정한 뒤, 기존
          견적서를 덮어쓰거나 새 견적서로 복사해서 저장할 수 있습니다.
        </p>
      </div>

      {loadError || !editContext ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError ?? "견적서를 불러오지 못했습니다."}
        </div>
      ) : (
        <EstimateBuilder
          catalog={catalog}
          providers={providers}
          receivers={receivers}
          initialTemplates={templates}
          discountPolicies={discountPolicies}
          editContext={editContext}
        />
      )}
    </main>
  );
}
