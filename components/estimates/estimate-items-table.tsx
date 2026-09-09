"use client";

import { Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { EstimateItemDraft } from "@/lib/estimates/types";
import { calculateDiscountRate, formatDiscountRate } from "@/lib/estimates/pricing";

interface EstimateItemsTableProps {
  items: EstimateItemDraft[];
  totalAmount: number;
  onRemove: (clientId: string) => void;
  onQuantityChange: (clientId: string, quantity: number) => void;
  onUnitPriceChange: (clientId: string, unitPrice: number) => void;
  onClearAll: () => void;
  disabled?: boolean;
}

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

export function EstimateItemsTable({
  items,
  totalAmount,
  onRemove,
  onQuantityChange,
  onUnitPriceChange,
  onClearAll,
  disabled,
}: EstimateItemsTableProps) {
  const handleClearAll = () => {
    if (items.length === 0) return;
    if (!window.confirm("담아둔 견적 목록을 전부 비울까요? 임시 저장된 내용도 함께 삭제됩니다.")) {
      return;
    }
    onClearAll();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>견적 목록 ({items.length}건)</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || items.length === 0}
          onClick={handleClearAll}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-4" />
          전체 목록 비우기
        </Button>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            위에서 장비를 선택해 추가하면 이곳에 목록이 표시됩니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">브랜드 / 카테고리</th>
                  <th className="py-2 pr-2 font-medium">장비명</th>
                  <th className="py-2 pr-2 font-medium">색상 / 사이즈</th>
                  <th className="py-2 pr-2 font-medium">수량</th>
                  <th className="py-2 pr-2 font-medium">단가</th>
                  <th className="py-2 pr-2 font-medium">소계</th>
                  <th className="py-2 pr-2 font-medium">비고</th>
                  <th className="py-2 pr-2 font-medium text-right">삭제</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const discountRate = calculateDiscountRate(
                    item.priceRetail,
                    item.unitPrice
                  );
                  return (
                  <tr key={item.clientId} className="border-b last:border-0">
                    <td className="py-2 pr-2 align-top text-muted-foreground">
                      {item.brand}
                      <br />
                      {item.category}
                    </td>
                    <td className="py-2 pr-2 align-top font-medium">
                      {item.name}
                    </td>
                    <td className="py-2 pr-2 align-top text-muted-foreground">
                      {item.color || "-"} / {item.size || "-"}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        value={item.quantity}
                        disabled={disabled}
                        className="w-20"
                        onChange={(event) =>
                          onQuantityChange(
                            item.clientId,
                            Math.max(1, Number(event.target.value) || 1)
                          )
                        }
                      />
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <Input
                        type="number"
                        min={0}
                        step={100}
                        value={item.unitPrice}
                        disabled={disabled}
                        className="w-28"
                        onChange={(event) =>
                          onUnitPriceChange(
                            item.clientId,
                            Math.max(0, Number(event.target.value) || 0)
                          )
                        }
                      />
                      {discountRate > 0 && (
                        <p className="mt-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          {formatDiscountRate(discountRate)}%↓
                          <span className="ml-1 text-muted-foreground line-through">
                            {formatCurrency(item.priceRetail)}
                          </span>
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-2 align-top font-medium">
                      {formatCurrency(item.unitPrice * item.quantity)}
                      {discountRate > 0 && (
                        <p className="mt-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                          -{formatDiscountRate(discountRate)}%
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-2 align-top text-muted-foreground">
                      {item.itemRemarks || "-"}
                    </td>
                    <td className="py-2 pr-2 align-top text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={disabled}
                        onClick={() => onRemove(item.clientId)}
                        aria-label={`${item.name} 삭제`}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="pt-3 text-right font-medium">
                    합계
                  </td>
                  <td className="pt-3 text-lg font-semibold" colSpan={3}>
                    {formatCurrency(totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
