"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { PrintControls } from "@/components/estimates/print-controls";
import {
  BasisTierSelect,
  ReferenceTierCheckboxes,
} from "@/components/estimates/price-tier-controls";
import {
  EstimateDocumentTable,
  type EstimateDocumentRow,
} from "@/components/estimates/estimate-document-table";
import {
  DeliveryNoteTable,
  type DeliveryNoteRow,
} from "@/components/estimates/delivery-note-table";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SavedEstimateDetail, SavedEstimateItemDetail } from "@/lib/estimates/types";
import {
  calculateDiscountRate,
  calculateInclusiveVat,
  getAllowedPriceTiers,
  resolveViewableTier,
  tierPriceOfSnapshot,
  PRICE_TIER_LABELS,
  type PriceTier,
} from "@/lib/estimates/pricing";

function formatSpec(color: string, size: string): string {
  return [color, size].filter(Boolean).join(" / ") || "-";
}

interface EstimatePrintViewProps {
  estimate: SavedEstimateDetail;
  /** 관리자 모드 여부 — 원가("COST") 등급은 관리자 모드에서만 선택할 수 있다. */
  isAdmin: boolean;
}

/**
 * 보관함에 저장된 견적서 1건의 상세/인쇄 화면. 상단 가격 등급 탭을 전환하면
 * 품목별 단가·소계·총액·할인율이 즉시 재계산되어 표시된다. 인쇄(@media
 * print) 시에는 탭 등 컨트롤 UI가 숨겨지고, 현재 화면에 선택되어 있는
 * 등급의 문서만 그대로 인쇄된다(탭마다 별도로 렌더링해두는 게 아니라, 이미
 * 선택된 한 등급만 DOM에 그려져 있기 때문에 별도 print CSS 분기가 필요 없다).
 */
interface PriceOverride {
  unitPrice?: number;
  amount?: number;
}

const TIER_SNAPSHOT_KEYS = {
  RETAIL: "priceRetail",
  INSTRUCTOR: "priceInstructor",
  CENTER: "priceCenter",
  COST: "priceCost",
} as const satisfies Record<PriceTier, keyof SavedEstimateItemDetail>;

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * 입력한 단가/금액을 품목에 반영한다. 금액 칸을 고친 경우 DB 에는 금액 컬럼이
 * 없으므로 금액 ÷ 수량을 단가로 저장한다(원 미만은 소수 둘째 자리까지 보관).
 * unit_price(견적서 합계의 기준)는 저장 등급을 고쳤을 때만 함께 바뀐다.
 */
function applyPriceOverride(
  item: SavedEstimateItemDetail,
  override: PriceOverride,
  tier: PriceTier,
  savedTier: PriceTier
): SavedEstimateItemDetail {
  const nextPrice =
    override.amount != null
      ? Math.round((override.amount / item.quantity) * 100) / 100
      : override.unitPrice;
  if (nextPrice == null) return item;

  return {
    ...item,
    [TIER_SNAPSHOT_KEYS[tier]]: nextPrice,
    unitPrice: tier === savedTier ? nextPrice : item.unitPrice,
  };
}

/** 저장된 견적서를 같은 내용으로 덮어쓰되 품목 가격만 바꾼다(PUT 재사용). */
async function saveEstimatePrices(
  estimate: SavedEstimateDetail,
  savedTier: PriceTier,
  items: SavedEstimateItemDetail[]
): Promise<void> {
  const response = await fetch(`/api/estimates/${estimate.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    // 저장 직후 페이지를 벗어나도 요청이 끊기지 않게 한다.
    keepalive: true,
    body: JSON.stringify({
      estimateNumber: estimate.estimateNumber,
      date: estimate.date,
      providerId: estimate.provider?.id,
      receiverId: estimate.receiver?.id,
      remarks: estimate.remarks,
      priceTier: savedTier,
      items: items.map((item) => ({
        equipmentId: item.equipmentId,
        name: item.name,
        brand: item.brand,
        category: item.category,
        color: item.color,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemRemarks: item.itemRemarks,
        priceRetail: item.priceRetail ?? undefined,
        priceInstructor: item.priceInstructor ?? undefined,
        priceCenter: item.priceCenter ?? undefined,
        priceCost: item.priceCost ?? undefined,
      })),
    }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "저장에 실패했습니다.");
  }
}

export function EstimatePrintView({ estimate, isAdmin }: EstimatePrintViewProps) {
  const router = useRouter();
  const savedTier = estimate.priceTier ?? "RETAIL";
  const [items, setItems] = React.useState(estimate.items);
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  // 저장은 품목 전체를 덮어쓰므로, 빠르게 연달아 고쳐도 순서가 뒤집히지 않게 줄 세운다.
  const saveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const allowedPriceTiers = React.useMemo(() => getAllowedPriceTiers(isAdmin), [isAdmin]);
  const [tier, setTier] = React.useState<PriceTier>(
    resolveViewableTier(estimate.priceTier, isAdmin)
  );
  const [referenceTiers, setReferenceTiers] = React.useState<PriceTier[]>([]);
  const [documentMode, setDocumentMode] = React.useState<"estimate" | "deliveryNote">(
    "estimate"
  );
  // 관리자 전용 단가/금액 수정 — 입력 중인 값만 품목 index(=rows 의 key)별로
  // 들고 있다가, 입력을 마치면(commitPriceEdits) 품목에 반영해 저장한다.
  const [priceOverrides, setPriceOverrides] = React.useState<Record<number, PriceOverride>>({});

  const handleUnitPriceChange = React.useCallback((rowKey: string | number, value: number) => {
    const index = Number(rowKey);
    setPriceOverrides((prev) => ({ ...prev, [index]: { unitPrice: value } }));
  }, []);

  const handleAmountChange = React.useCallback((rowKey: string | number, value: number) => {
    const index = Number(rowKey);
    setPriceOverrides((prev) => ({ ...prev, [index]: { ...prev[index], amount: value } }));
  }, []);

  const persistItems = React.useCallback(
    (nextItems: SavedEstimateItemDetail[]) => {
      setSaveStatus("saving");
      setSaveError(null);
      saveQueueRef.current = saveQueueRef.current.then(async () => {
        try {
          await saveEstimatePrices(estimate, savedTier, nextItems);
          setSaveStatus("saved");
          router.refresh();
        } catch (error) {
          console.error("견적서 가격 저장 실패:", error);
          setSaveStatus("error");
          setSaveError(error instanceof Error ? error.message : "저장에 실패했습니다.");
        }
      });
    },
    [estimate, savedTier, router]
  );

  const commitPriceEdits = () => {
    const nextItems = items.map((item, index) => {
      const override = priceOverrides[index];
      return override ? applyPriceOverride(item, override, tier, savedTier) : item;
    });
    setPriceOverrides({});
    const changed = nextItems.some(
      (item, index) =>
        tierPriceOfSnapshot(item, tier) !== tierPriceOfSnapshot(items[index], tier)
    );
    if (!changed) return;
    setItems(nextItems);
    persistItems(nextItems);
  };

  const hasTierSnapshot = items.some(
    (item) =>
      item.priceRetail !== null ||
      item.priceInstructor !== null ||
      item.priceCenter !== null ||
      item.priceCost !== null
  );

  const rows: EstimateDocumentRow[] = items.map((item, index) => {
    const baseUnitPrice = tierPriceOfSnapshot(item, tier);
    const baseAmount = baseUnitPrice * item.quantity;
    const override = priceOverrides[index];
    const unitPrice = override?.unitPrice ?? baseUnitPrice;
    const amount =
      override?.amount ??
      (override?.unitPrice != null ? override.unitPrice * item.quantity : baseAmount);
    const retailReference = item.priceRetail ?? item.unitPrice;
    return {
      seq: index + 1,
      key: index,
      // 거래명세서와 동일하게, 견적서 품목명도 브랜드 말머리 없이 순수
      // 품명만 표시한다.
      name: item.name.trim(),
      spec: formatSpec(item.color, item.size),
      unit: "개",
      quantity: item.quantity,
      unitPrice,
      amount,
      vat: calculateInclusiveVat(amount),
      itemRemarks: item.itemRemarks,
      discountRate: calculateDiscountRate(retailReference, unitPrice),
      // 저장 시점 4개 등급 스냅샷에서 그대로 뽑아 쓴다 — 참고 등급 선택은
      // 총액 계산과 무관한 순수 표시 옵션이라 새 DB 컬럼 없이도 충분하다.
      referenceValues: referenceTiers.map((refTier) => tierPriceOfSnapshot(item, refTier)),
    };
  });

  const referenceTierLabels = referenceTiers.map((refTier) => PRICE_TIER_LABELS[refTier]);

  // 거래명세서용 데이터 — 견적서와 같은 기준 등급(tier)의 최종 금액(amount)을
  // 그대로 쓰되, 공급가액/세액으로 역산해서 나눈다(calculateInclusiveVat 재사용).
  // 새로 부가세를 얹는 게 아니라 이미 확정된 금액을 쪼개는 것이라, 거래명세서
  // 합계금액은 견적서 합계금액과 항상 정확히 같다.
  const deliveryNoteRows: DeliveryNoteRow[] = items.map((item, index) => {
    const baseUnitPrice = tierPriceOfSnapshot(item, tier);
    const baseAmount = baseUnitPrice * item.quantity;
    const override = priceOverrides[index];
    const amount =
      override?.amount ??
      (override?.unitPrice != null ? override.unitPrice * item.quantity : baseAmount);
    const vat = calculateInclusiveVat(amount);
    const supplyAmount = amount - vat;
    return {
      seq: index + 1,
      key: index,
      // 견적서 표와 동일하게 브랜드/카테고리 말머리 없이 순수 품명만 표시한다.
      name: item.name.trim(),
      spec: formatSpec(item.color, item.size),
      quantity: item.quantity,
      unitPrice: item.quantity > 0 ? Math.round(supplyAmount / item.quantity) : supplyAmount,
      supplyAmount,
      vat,
    };
  });
  const deliveryNoteGrandTotal = deliveryNoteRows.reduce(
    (s, r) => s + r.supplyAmount + r.vat,
    0
  );

  return (
    // pb-10 은 화면에서 아래쪽 여백을 주기 위한 것뿐인데, 위쪽의 두
    // print:hidden 블록(PrintControls, 등급 탭)과 달리 이 padding 은 print
    // 미디어에서도 그대로 적용돼 왔다 — 인쇄물에서 견적서 표 바로 아래에
    // 40px(~10.6mm)가 항상 더 붙는 셈이라, A4 한 장에 거의 딱 맞는
    // 견적서는 이 padding 때문에 살짝 넘쳐 빈 2페이지가 따라 나왔다.
    // print:pb-0 으로 인쇄 시에만 없앤다(화면에서는 그대로 pb-10 유지).
    <main className="flex flex-col gap-4 pb-10 print:pb-0">
      <PrintControls
        estimateId={estimate.id}
        fileName={
          documentMode === "estimate"
            ? `견적서_${estimate.estimateNumber}`
            : `거래명세서_${estimate.estimateNumber}`
        }
      />

      <div className="mx-auto flex w-full max-w-4xl flex-wrap gap-2 px-4 print:hidden">
        <Button
          type="button"
          variant={documentMode === "estimate" ? "default" : "outline"}
          className={cn(documentMode !== "estimate" && "text-muted-foreground")}
          onClick={() => setDocumentMode("estimate")}
        >
          견적서 보기/인쇄
        </Button>
        <Button
          type="button"
          variant={documentMode === "deliveryNote" ? "default" : "outline"}
          className={cn(documentMode !== "deliveryNote" && "text-muted-foreground")}
          onClick={() => setDocumentMode("deliveryNote")}
        >
          거래명세서 보기/인쇄
        </Button>
      </div>

      {documentMode === "estimate" && (
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 print:hidden">
          <BasisTierSelect value={tier} onChange={setTier} tiers={allowedPriceTiers} />
          <ReferenceTierCheckboxes
            value={referenceTiers}
            onChange={setReferenceTiers}
            tiers={allowedPriceTiers}
          />
          {!hasTierSnapshot && (
            <p className="text-xs text-muted-foreground">
              이전 버전에 저장된 견적서라 등급별 단가가 남아있지 않습니다 — 모든 등급에 저장 당시 단가가 동일하게 표시됩니다.
            </p>
          )}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <p>
                관리자 모드: 아래 표의 단가·금액을 고치고 칸을 벗어나면(또는 Enter) 보관된 견적서에 바로 저장됩니다.
              </p>
              {saveStatus === "saving" && <span>저장 중...</span>}
              {saveStatus === "saved" && <span className="text-foreground">저장되었습니다.</span>}
              {saveStatus === "error" && (
                <>
                  <span className="text-destructive">저장 실패: {saveError}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => persistItems(items)}
                  >
                    다시 저장
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-4xl px-4">
        <div className="estimate-a4-page">
          {documentMode === "estimate" ? (
            <EstimateDocumentTable
              estimateNumber={estimate.estimateNumber}
              date={estimate.date}
              provider={estimate.provider}
              receiver={estimate.receiver}
              remarks={estimate.remarks}
              rows={rows}
              referenceTierLabels={referenceTierLabels}
              editable={isAdmin}
              onUnitPriceChange={handleUnitPriceChange}
              onAmountChange={handleAmountChange}
              onPriceEditCommit={commitPriceEdits}
            />
          ) : (
            <div className="delivery-note-page">
              <DeliveryNoteTable
                copyLabel="공급받는자 보관용"
                date={estimate.date}
                provider={estimate.provider}
                receiver={estimate.receiver}
                rows={deliveryNoteRows}
                grandTotal={deliveryNoteGrandTotal}
              />
              <div className="delivery-note-divider" />
              <DeliveryNoteTable
                copyLabel="공급자 보관용"
                date={estimate.date}
                provider={estimate.provider}
                receiver={estimate.receiver}
                rows={deliveryNoteRows}
                grandTotal={deliveryNoteGrandTotal}
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
