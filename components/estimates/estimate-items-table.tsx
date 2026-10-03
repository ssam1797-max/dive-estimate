"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Minus, Plus, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { EquipmentThumbnail } from "@/components/equipment/equipment-thumbnail";
import type { EquipmentCatalogItem, EstimateItemDraft } from "@/lib/estimates/types";
import {
  calculateDiscountRate,
  calculateEffectiveUnitPrice,
  formatDiscountRate,
  type DiscountPolicyMap,
} from "@/lib/estimates/pricing";

interface EstimateItemsTableProps {
  items: EstimateItemDraft[];
  totalAmount: number;
  /** "퐁당샵가격" 참고 열을 계산하기 위한 브랜드별 할인율 정책. */
  discountPolicies: DiscountPolicyMap;
  /** 품목별 썸네일(image_url) 조회용 — equipmentId 로 찾는다. 수동 등록 품목처럼
   *  매칭되는 카탈로그 항목이 없으면 기본 아이콘으로 표시된다. */
  catalog: EquipmentCatalogItem[];
  onRemove: (clientId: string) => void;
  onQuantityChange: (clientId: string, quantity: number) => void;
  onNameChange: (clientId: string, name: string) => void;
  onColorChange: (clientId: string, color: string) => void;
  onSizeChange: (clientId: string, size: string) => void;
  onMoveUp: (clientId: string) => void;
  onMoveDown: (clientId: string) => void;
  onClearAll: () => void;
  onItemRemarksChange: (clientId: string, itemRemarks: string) => void;
  disabled?: boolean;
}

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

export function EstimateItemsTable({
  items,
  totalAmount,
  discountPolicies,
  catalog,
  onRemove,
  onQuantityChange,
  onNameChange,
  onColorChange,
  onSizeChange,
  onMoveUp,
  onMoveDown,
  onClearAll,
  onItemRemarksChange,
  disabled,
}: EstimateItemsTableProps) {
  const [confirmClearOpen, setConfirmClearOpen] = React.useState(false);

  const imageByEquipmentId = React.useMemo(() => {
    const map = new Map<string, string | null>();
    for (const eq of catalog) map.set(eq.id, eq.image_url);
    return map;
  }, [catalog]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>🛒 장바구니 ({items.length}건)</CardTitle>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || items.length === 0}
          onClick={() => setConfirmClearOpen(true)}
          className="text-muted-foreground hover:text-destructive"
        >
          <X className="size-4" />
          전체 목록 비우기
        </Button>
        <ConfirmDialog
          open={confirmClearOpen}
          onOpenChange={setConfirmClearOpen}
          title="목록을 전부 비울까요?"
          description="담아둔 견적 목록을 전부 비웁니다. 임시 저장된 내용도 함께 삭제됩니다."
          confirmLabel="비우기"
          onConfirm={onClearAll}
        />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            위에서 장비를 선택해 추가하면 이곳에 목록이 표시됩니다.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-medium">순서</th>
                  <th className="py-2 pr-2 font-medium">제품 정보</th>
                  <th className="py-2 pr-2 font-medium">수량</th>
                  <th className="py-2 pr-2 font-medium">소비자가격</th>
                  <th className="py-2 pr-2 font-medium">퐁당샵가격</th>
                  <th className="py-2 pr-2 font-medium">공급가격</th>
                  <th className="py-2 pr-2 font-medium">소계</th>
                  <th className="py-2 pr-2 font-medium">비고</th>
                  <th className="py-2 pr-2 font-medium text-right">삭제</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const discountRate = calculateDiscountRate(
                    item.priceRetail,
                    item.unitPrice
                  );
                  const shopPrice = calculateEffectiveUnitPrice(
                    item.priceRetail,
                    item.brand,
                    "INSTRUCTOR",
                    discountPolicies,
                    item.overrideDiscountRate
                  );
                  return (
                  <tr key={item.clientId} className="border-b last:border-0">
                    <td className="py-2 pr-2 align-top">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={disabled || index === 0}
                          onClick={() => onMoveUp(item.clientId)}
                          aria-label={`${item.name} 위로 이동`}
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={disabled || index === items.length - 1}
                          onClick={() => onMoveDown(item.clientId)}
                          aria-label={`${item.name} 아래로 이동`}
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <div className="flex gap-2">
                        <EquipmentThumbnail
                          src={imageByEquipmentId.get(item.equipmentId) ?? null}
                          alt={item.name}
                        />
                        <div className="flex min-w-0 flex-col gap-1.5">
                          {item.brand && (
                            <span className="text-xs text-muted-foreground">{item.brand}</span>
                          )}
                          <Input
                            value={item.name}
                            disabled={disabled}
                            title={item.name}
                            className="w-40 font-medium"
                            onChange={(event) => onNameChange(item.clientId, event.target.value)}
                          />
                          <div className="flex gap-1.5">
                            <Input
                              value={item.color}
                              disabled={disabled}
                              className="w-[4.75rem]"
                              placeholder="색상"
                              onChange={(event) => onColorChange(item.clientId, event.target.value)}
                            />
                            <Input
                              value={item.size}
                              disabled={disabled}
                              className="w-[4.75rem]"
                              placeholder="사이즈"
                              onChange={(event) => onSizeChange(item.clientId, event.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          disabled={disabled || item.quantity <= 1}
                          onClick={() => onQuantityChange(item.clientId, item.quantity - 1)}
                          aria-label={`${item.name} 수량 줄이기`}
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={item.quantity}
                          disabled={disabled}
                          // 양옆에 이미 증감 버튼이 있어 브라우저 기본 스피너 화살표가
                          // 필요 없는데, 숫자가 세 자리가 되면 그 화살표가 숫자 위에
                          // 겹쳐 보이던 문제가 있었다 — 기본 스피너를 꺼서 해결.
                          className="w-16 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          onChange={(event) =>
                            onQuantityChange(
                              item.clientId,
                              Math.max(1, Number(event.target.value) || 1)
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-7 shrink-0"
                          disabled={disabled}
                          onClick={() => onQuantityChange(item.clientId, item.quantity + 1)}
                          aria-label={`${item.name} 수량 늘리기`}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-2 pr-2 align-top">
                      {formatCurrency(item.priceRetail)}
                    </td>
                    <td className="py-2 pr-2 align-top text-muted-foreground">
                      {formatCurrency(shopPrice)}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      {formatCurrency(item.unitPrice)}
                      {discountRate > 0 && (
                        <p className="mt-1 text-xs font-medium text-teal-400">
                          {formatDiscountRate(discountRate)}%↓
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-2 align-top font-medium">
                      {formatCurrency(item.unitPrice * item.quantity)}
                      {discountRate > 0 && (
                        <p className="mt-1 text-xs font-normal text-teal-400">
                          -{formatDiscountRate(discountRate)}%
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-2 align-top">
                      <Input
                        value={item.itemRemarks}
                        disabled={disabled}
                        className="w-28"
                        placeholder="예: 10% 할인"
                        onChange={(event) =>
                          onItemRemarksChange(item.clientId, event.target.value)
                        }
                      />
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
            </table>
          </div>
        )}
        {items.length > 0 && (
          // 합계는 가로 스크롤되는 테이블 밖에 둔다 — 테이블 안(tfoot)에 있으면
          // 화면이 좁을 때 오른쪽으로 스크롤해야만 보여서 "최종가격이 안 보인다"는
          // 문제가 있었다.
          <div className="mt-3 flex items-center justify-end gap-3 border-t pt-3">
            <span className="font-medium">합계</span>
            <span className="text-lg font-semibold">{formatCurrency(totalAmount)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
