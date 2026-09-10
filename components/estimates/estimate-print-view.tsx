"use client";

import * as React from "react";

import { PrintControls } from "@/components/estimates/print-controls";
import { PriceTierSelect } from "@/components/estimates/price-tier-select";
import {
  EstimateDocumentTable,
  type EstimateDocumentRow,
} from "@/components/estimates/estimate-document-table";
import type { SavedEstimateDetail } from "@/lib/estimates/types";
import {
  calculateDiscountRate,
  calculateInclusiveVat,
  tierPriceOfSnapshot,
  type PriceTier,
} from "@/lib/estimates/pricing";

function formatSpec(color: string, size: string): string {
  return [color, size].filter(Boolean).join(" / ") || "-";
}

interface EstimatePrintViewProps {
  estimate: SavedEstimateDetail;
}

/**
 * 보관함에 저장된 견적서 1건의 상세/인쇄 화면. 상단 가격 등급 탭을 전환하면
 * 품목별 단가·소계·총액·할인율이 즉시 재계산되어 표시된다. 인쇄(@media
 * print) 시에는 탭 등 컨트롤 UI가 숨겨지고, 현재 화면에 선택되어 있는
 * 등급의 문서만 그대로 인쇄된다(탭마다 별도로 렌더링해두는 게 아니라, 이미
 * 선택된 한 등급만 DOM에 그려져 있기 때문에 별도 print CSS 분기가 필요 없다).
 */
export function EstimatePrintView({ estimate }: EstimatePrintViewProps) {
  const [tier, setTier] = React.useState<PriceTier>(estimate.priceTier ?? "RETAIL");

  const hasTierSnapshot = estimate.items.some(
    (item) =>
      item.priceRetail !== null ||
      item.priceInstructor !== null ||
      item.priceCenter !== null ||
      item.priceCost !== null
  );

  const rows: EstimateDocumentRow[] = estimate.items.map((item, index) => {
    const unitPrice = tierPriceOfSnapshot(item, tier);
    const amount = unitPrice * item.quantity;
    const retailReference = item.priceRetail ?? item.unitPrice;
    return {
      seq: index + 1,
      key: index,
      name: `${item.brand} ${item.name}`.trim(),
      spec: formatSpec(item.color, item.size),
      unit: "개",
      quantity: item.quantity,
      unitPrice,
      amount,
      vat: calculateInclusiveVat(amount),
      itemRemarks: item.itemRemarks,
      discountRate: calculateDiscountRate(retailReference, unitPrice),
      priceRetail: item.priceRetail ?? undefined,
    };
  });

  return (
    // pb-10 은 화면에서 아래쪽 여백을 주기 위한 것뿐인데, 위쪽의 두
    // print:hidden 블록(PrintControls, 등급 탭)과 달리 이 padding 은 print
    // 미디어에서도 그대로 적용돼 왔다 — 인쇄물에서 견적서 표 바로 아래에
    // 40px(~10.6mm)가 항상 더 붙는 셈이라, A4 한 장에 거의 딱 맞는
    // 견적서는 이 padding 때문에 살짝 넘쳐 빈 2페이지가 따라 나왔다.
    // print:pb-0 으로 인쇄 시에만 없앤다(화면에서는 그대로 pb-10 유지).
    <main className="flex flex-col gap-4 pb-10 print:pb-0">
      <PrintControls estimateId={estimate.id} fileName={`견적서_${estimate.estimateNumber}`} />

      <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 print:hidden">
        <PriceTierSelect value={tier} onChange={setTier} />
        {!hasTierSnapshot && (
          <p className="text-xs text-muted-foreground">
            이전 버전에 저장된 견적서라 등급별 단가가 남아있지 않습니다 — 모든 탭에 저장 당시 단가가 동일하게 표시됩니다.
          </p>
        )}
      </div>

      <div className="mx-auto w-full max-w-4xl px-4">
        <div className="estimate-a4-page">
          <EstimateDocumentTable
            estimateNumber={estimate.estimateNumber}
            date={estimate.date}
            provider={estimate.provider}
            receiver={estimate.receiver}
            remarks={estimate.remarks}
            rows={rows}
          />
        </div>
      </div>
    </main>
  );
}
