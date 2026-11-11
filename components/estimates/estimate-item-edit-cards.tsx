"use client";

import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  EditableMoneyInput,
  EditableOptionInput,
  EditableQuantityInput,
} from "@/components/estimates/editable-fields";
import type { EstimateDocumentRow } from "@/components/estimates/estimate-document-table";

/**
 * 관리자 전용 — 저장된 견적서의 품목별 옵션(색상/사이즈)·수량·단가·금액을
 * 고치는 모바일용 카드 목록. 휴대폰에서는 A4 문서가 화면 폭에 맞게 축소되어
 * 표 안의 인라인 입력란을 손가락으로 누르기 어려우므로, 같은 수정 기능을
 * 큰 입력란으로 따로 제공한다(호출부가 sm 미만에서만 보이게 한다).
 *
 * 문서 표(EstimateDocumentTable)와 똑같은 rows/핸들러를 그대로 받는다 —
 * 어느 쪽에서 고치든 같은 상태가 바뀌고 같은 방식으로 저장된다.
 */
interface EstimateItemEditCardsProps {
  rows: EstimateDocumentRow[];
  onUnitPriceChange: (rowKey: string | number, value: number) => void;
  onAmountChange: (rowKey: string | number, value: number) => void;
  onPriceEditCommit: () => void;
  onQuantityCommit: (rowKey: string | number, quantity: number) => void;
  onSpecCommit: (rowKey: string | number, spec: { color: string; size: string }) => void;
}

// text-base(16px) — iOS Safari 는 16px 미만 입력란에 포커스가 가면 화면을
// 자동으로 확대해 버린다.
const fieldInput =
  "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-base shadow-sm " +
  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
const fieldLabel = "flex min-w-0 flex-col gap-1 text-xs text-muted-foreground";

export function EstimateItemEditCards({
  rows,
  onUnitPriceChange,
  onAmountChange,
  onPriceEditCommit,
  onQuantityCommit,
  onSpecCommit,
}: EstimateItemEditCardsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">품목 수정 (관리자)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {rows.map((row) => (
          <div
            key={row.key}
            className="flex flex-col gap-3 border-b pb-4 last:border-0 last:pb-0"
          >
            <p className="break-keep text-sm font-medium">
              <span className="mr-1.5 text-muted-foreground">{row.seq}.</span>
              {row.name}
            </p>

            <div className="grid grid-cols-2 gap-2">
              <label className={fieldLabel}>
                색상
                <EditableOptionInput
                  className={`${fieldInput} text-foreground`}
                  value={row.color ?? ""}
                  label={`${row.name} 색상 수정`}
                  placeholder="없음"
                  options={row.colorOptions}
                  onCommit={(color) => onSpecCommit(row.key, { color, size: row.size ?? "" })}
                />
              </label>
              <label className={fieldLabel}>
                사이즈
                <EditableOptionInput
                  className={`${fieldInput} text-foreground`}
                  value={row.size ?? ""}
                  label={`${row.name} 사이즈 수정`}
                  placeholder="없음"
                  options={row.sizeOptions}
                  onCommit={(size) => onSpecCommit(row.key, { color: row.color ?? "", size })}
                />
              </label>
            </div>

            <div className={fieldLabel}>
              수량
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0"
                  disabled={row.quantity <= 1}
                  onClick={() => onQuantityCommit(row.key, row.quantity - 1)}
                  aria-label={`${row.name} 수량 줄이기`}
                >
                  <Minus className="size-4" />
                </Button>
                <EditableQuantityInput
                  className={`${fieldInput} text-center text-foreground`}
                  value={row.quantity}
                  label={`${row.name} 수량 수정`}
                  onCommit={(quantity) => onQuantityCommit(row.key, quantity)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0"
                  onClick={() => onQuantityCommit(row.key, row.quantity + 1)}
                  aria-label={`${row.name} 수량 늘리기`}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className={fieldLabel}>
                단가
                <EditableMoneyInput
                  className={`${fieldInput} text-right text-foreground`}
                  value={row.unitPrice}
                  label={`${row.name} 단가 수정`}
                  onChange={(value) => onUnitPriceChange(row.key, value)}
                  onCommit={onPriceEditCommit}
                />
              </label>
              <label className={fieldLabel}>
                금액
                <EditableMoneyInput
                  className={`${fieldInput} text-right text-foreground`}
                  value={row.amount}
                  label={`${row.name} 금액 수정`}
                  onChange={(value) => onAmountChange(row.key, value)}
                  onCommit={onPriceEditCommit}
                />
              </label>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
