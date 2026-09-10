"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  calculateDiscountRate,
  calculateEffectiveUnitPrice,
  calculateInclusiveVat,
  PRICE_TIER_LABELS,
  type DiscountPolicyMap,
  type PriceTier,
} from "@/lib/estimates/pricing";
import type { EstimateItemDraft, ProfileOption } from "@/lib/estimates/types";
import {
  EstimateDocumentTable,
  type EstimateDocumentRow,
} from "@/components/estimates/estimate-document-table";

interface ExcelPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateNumber: string;
  date: string;
  provider: ProfileOption | null;
  receiver: ProfileOption | null;
  remarks: string;
  priceTier: PriceTier;
  /** 참고용으로 함께 표시할 등급들(0~4개, 체크박스 다중 선택). 총액 계산에는 영향 없음. */
  referenceTiers: PriceTier[];
  items: EstimateItemDraft[];
  discountPolicies: DiscountPolicyMap;
}

function formatSpec(color: string, size: string): string {
  return [color, size].filter(Boolean).join(" / ") || "-";
}

export function ExcelPreviewDialog({
  open,
  onOpenChange,
  estimateNumber,
  date,
  provider,
  receiver,
  remarks,
  priceTier,
  referenceTiers,
  items,
  discountPolicies,
}: ExcelPreviewDialogProps) {
  const rows: EstimateDocumentRow[] = React.useMemo(
    () =>
      items.map((item, index) => {
        const unitPrice = calculateEffectiveUnitPrice(
          item.priceRetail,
          item.brand,
          priceTier,
          discountPolicies
        );
        const amount = unitPrice * item.quantity;
        return {
          seq: index + 1,
          key: item.clientId,
          name: `${item.brand} ${item.name}`,
          spec: formatSpec(item.color, item.size),
          unit: "개",
          quantity: item.quantity,
          unitPrice,
          amount,
          vat: calculateInclusiveVat(amount),
          itemRemarks: item.itemRemarks,
          discountRate: calculateDiscountRate(item.priceRetail, unitPrice),
          referenceValues: referenceTiers.map((tier) =>
            calculateEffectiveUnitPrice(item.priceRetail, item.brand, tier, discountPolicies)
          ),
        };
      }),
    [items, priceTier, referenceTiers, discountPolicies]
  );

  const referenceTierLabels = referenceTiers.map((tier) => PRICE_TIER_LABELS[tier]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} widthClassName="max-w-5xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>엑셀 미리보기</DialogTitle>
          <DialogDescription>
            &quot;{PRICE_TIER_LABELS[priceTier]}&quot; 기준으로 계산된 금액입니다. 실제
            다운로드되는 .xlsx 파일과 동일한 내용입니다.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto max-h-[75vh]">
          <div className="min-w-[720px]">
            <EstimateDocumentTable
              estimateNumber={estimateNumber}
              date={date}
              provider={provider}
              receiver={receiver}
              remarks={remarks}
              rows={rows}
              referenceTierLabels={referenceTierLabels}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
