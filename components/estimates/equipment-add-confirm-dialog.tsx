"use client";

import * as React from "react";
import { Minus, Plus, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { EquipmentThumbnail } from "@/components/equipment/equipment-thumbnail";
import type { EquipmentCatalogItem } from "@/lib/estimates/types";
import {
  calculateDiscountRate,
  calculateEffectiveUnitPrice,
  formatDiscountRate,
  type DiscountPolicyMap,
  type PriceTier,
} from "@/lib/estimates/pricing";

interface EquipmentAddConfirmDialogProps {
  item: EquipmentCatalogItem;
  onOpenChange: (open: boolean) => void;
  onConfirm: (details: { quantity: number; color: string; size: string }) => void;
  priceTier: PriceTier;
  discountPolicies: DiscountPolicyMap;
}

const NO_OPTION_VALUE = "__none__";

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

/**
 * "키워드 통합 검색" 결과를 클릭했을 때 뜨는, 장바구니에 담기 전 마지막
 * 확인 모달. 검색 목록 자체에는 썸네일을 넣지 않는 대신(equipment-quick-
 * search.tsx 참고), 여기서 상품 이미지를 큼직하게 보여줘 "내가 고른 게
 * 맞는지"를 장바구니에 담기 전에 확인할 수 있게 한다.
 *
 * 부모(EquipmentPicker)가 품목을 클릭할 때마다 이 컴포넌트를 item.id를
 * key로 다시 마운트시키므로(= 품목이 바뀌면 내부 state가 항상 새로
 * 시작됨), effect로 state를 리셋할 필요가 없다 — sync-result-dialog.tsx와
 * 동일한 패턴.
 */
export function EquipmentAddConfirmDialog({
  item,
  onOpenChange,
  onConfirm,
  priceTier,
  discountPolicies,
}: EquipmentAddConfirmDialogProps) {
  const [quantity, setQuantity] = React.useState(1);
  const [color, setColor] = React.useState("");
  const [size, setSize] = React.useState("");

  const colorOptions = item.colors;
  const sizeOptions = item.sizes;

  const unitPrice = calculateEffectiveUnitPrice(
    item.price_retail,
    item.brand,
    priceTier,
    discountPolicies,
    item.override_discount_rate
  );
  const discountRate = calculateDiscountRate(item.price_retail, unitPrice);

  const canConfirm =
    (colorOptions.length === 0 || color !== "") &&
    (sizeOptions.length === 0 || size !== "") &&
    quantity > 0;

  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      // 모바일에서 화면 폭의 90%를 쓰되 480px을 넘지 않게(한 손 조작 폭 안에
      // 들어오도록) — 데스크톱에서도 같은 상한을 그대로 적용한다.
      widthClassName="w-[90vw] max-w-[480px]"
    >
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>장바구니에 담기</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 sm:flex-row">
          <EquipmentThumbnail
            src={item.image_url}
            alt={item.name}
            className="h-48 w-full shrink-0 rounded-lg sm:h-40 sm:w-40"
            iconClassName="size-10"
          />

          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{item.brand}</p>
              <p className="text-base font-semibold leading-snug">{item.name}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {colorOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-color">색상</Label>
                  <Select
                    id="confirm-color"
                    value={color === "" ? NO_OPTION_VALUE : color}
                    onChange={(event) =>
                      setColor(event.target.value === NO_OPTION_VALUE ? "" : event.target.value)
                    }
                  >
                    <option value={NO_OPTION_VALUE} disabled>
                      색상을 선택하세요
                    </option>
                    {colorOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>
              )}

              {sizeOptions.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="confirm-size">사이즈</Label>
                  <Select
                    id="confirm-size"
                    value={size === "" ? NO_OPTION_VALUE : size}
                    onChange={(event) =>
                      setSize(event.target.value === NO_OPTION_VALUE ? "" : event.target.value)
                    }
                  >
                    <option value={NO_OPTION_VALUE} disabled>
                      사이즈를 선택하세요
                    </option>
                    {sizeOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm-quantity">수량</Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="수량 줄이기"
                >
                  <Minus className="size-3.5" />
                </Button>
                <input
                  id="confirm-quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={quantity}
                  onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                  className="h-8 w-16 rounded-md border border-input bg-background text-center text-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-8 shrink-0"
                  onClick={() => setQuantity((q) => q + 1)}
                  aria-label="수량 늘리기"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">소비자가</span>
                <span className={discountRate > 0 ? "text-muted-foreground line-through" : "font-medium"}>
                  {formatCurrency(item.price_retail)}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className="text-muted-foreground">적용 단가</span>
                <span className="font-medium">
                  {formatCurrency(unitPrice)}
                  {discountRate > 0 && (
                    <span className="ml-1.5 text-xs font-medium text-teal-400">
                      {formatDiscountRate(discountRate)}%↓
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t pt-2 font-semibold">
                <span>소계</span>
                <span>{formatCurrency(unitPrice * quantity)}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            취소
          </Button>
          <Button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm({ quantity, color, size })}
          >
            <ShoppingCart className="size-4" />
            장바구니 담기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
