"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EquipmentCatalogItem, EstimateItemDraft } from "@/lib/estimates/types";
import {
  calculateEffectiveUnitPrice,
  type DiscountPolicyMap,
  type PriceTier,
} from "@/lib/estimates/pricing";

interface ManualItemFormProps {
  catalog: EquipmentCatalogItem[];
  onAdd: (item: EstimateItemDraft) => void;
  priceTier: PriceTier;
  discountPolicies: DiscountPolicyMap;
  disabled?: boolean;
}

/**
 * 퐁당닷컴 검색/카탈로그 선택 없이 사용자가 직접 품명·규격·수량·소비자가·
 * 할인율을 입력해 견적 목록에 담는 폼. equipmentId 를 빈 문자열("")로 담아
 * 보내면(EstimateItemDraft.equipmentId === "" → SaveEstimateItemPayload.
 * equipmentId === null) 이 항목은 장비 마스터(equipment 테이블)와 전혀
 * 연결되지 않고 estimate_items 자체에 품명/브랜드/카테고리가 직접 저장된다
 * (estimate-repo.ts 의 item_name/item_brand/item_category 컬럼) — 그래서
 * 이 항목은 퐁당닷컴 재동기화(equipment 테이블만 건드림)의 영향을 원천적으로
 * 받지 않는다. equipment 마스터에 별도로 is_custom 보호 플래그를 쓸 필요가
 * 없는 이유가 바로 이것이다.
 */
export function ManualItemForm({
  catalog,
  onAdd,
  priceTier,
  discountPolicies,
  disabled,
}: ManualItemFormProps) {
  const [open, setOpen] = React.useState(false);
  const [brand, setBrand] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("");
  const [size, setSize] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [priceRetail, setPriceRetail] = React.useState(0);
  const [discountRate, setDiscountRate] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const brandOptions: ComboboxOption[] = React.useMemo(() => {
    const unique = Array.from(new Set(catalog.map((item) => item.brand)));
    unique.sort((a, b) => a.localeCompare(b, "ko"));
    return unique.map((value) => ({ value, label: value }));
  }, [catalog]);

  const overrideRate = discountRate.trim() === "" ? null : Number(discountRate);

  const previewUnitPrice = React.useMemo(() => {
    if (!brand.trim()) return null;
    return calculateEffectiveUnitPrice(
      priceRetail,
      brand,
      priceTier,
      discountPolicies,
      overrideRate
    );
  }, [brand, priceRetail, priceTier, discountPolicies, overrideRate]);

  const resetForm = () => {
    setBrand("");
    setCategory("");
    setName("");
    setColor("");
    setSize("");
    setQuantity(1);
    setPriceRetail(0);
    setDiscountRate("");
    setError(null);
  };

  const handleSubmit = () => {
    if (!brand.trim()) {
      setError("브랜드를 입력해주세요.");
      return;
    }
    if (!name.trim()) {
      setError("품명을 입력해주세요.");
      return;
    }
    if (quantity <= 0) {
      setError("수량은 1개 이상이어야 합니다.");
      return;
    }
    if (overrideRate !== null && (Number.isNaN(overrideRate) || overrideRate < 0 || overrideRate > 100)) {
      setError("할인율은 0~100 사이 숫자여야 합니다.");
      return;
    }

    const unitPrice = calculateEffectiveUnitPrice(
      priceRetail,
      brand,
      priceTier,
      discountPolicies,
      overrideRate
    );

    onAdd({
      clientId: crypto.randomUUID(),
      // 빈 문자열 그대로 둔다 — SaveEstimateItemPayload.equipmentId 로 변환될 때
      // null 이 되어 equipment 마스터와 연결되지 않는다(수동 입력 품목의 핵심).
      equipmentId: "",
      brand: brand.trim(),
      category: category.trim(),
      name: name.trim(),
      color: color.trim(),
      size: size.trim(),
      quantity,
      priceRetail,
      unitPrice,
      itemRemarks: "",
      overrideDiscountRate: overrideRate,
    });

    resetForm();
    setOpen(false);
  };

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="self-start"
      >
        <Plus className="size-4" />
        품목 직접 추가
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-dashed p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          품목 직접 추가
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            퐁당닷컴 검색 없이 직접 입력합니다.
          </span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          onClick={() => {
            resetForm();
            setOpen(false);
          }}
          aria-label="직접 추가 취소"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-brand">브랜드 *</Label>
          <Combobox
            id="manual-brand"
            options={brandOptions}
            value={brand}
            onChange={setBrand}
            allowCustomValue
            placeholder="브랜드를 검색하거나 새로 입력하세요"
            searchPlaceholder="브랜드 검색..."
            emptyMessage="일치하는 브랜드가 없습니다."
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-category">카테고리</Label>
          <Input
            id="manual-category"
            value={category}
            disabled={disabled}
            placeholder="예: 호흡기"
            onChange={(event) => setCategory(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-name">품명 *</Label>
          <Input
            id="manual-name"
            value={name}
            disabled={disabled}
            placeholder="예: XT 핀"
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-color">색상</Label>
          <Input
            id="manual-color"
            value={color}
            disabled={disabled}
            onChange={(event) => setColor(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-size">사이즈</Label>
          <Input
            id="manual-size"
            value={size}
            disabled={disabled}
            onChange={(event) => setSize(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-quantity">수량 *</Label>
          <Input
            id="manual-quantity"
            type="number"
            min={1}
            step={1}
            value={quantity}
            disabled={disabled}
            onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-price-retail">소비자가 *</Label>
          <Input
            id="manual-price-retail"
            type="number"
            min={0}
            step={100}
            value={priceRetail}
            disabled={disabled}
            onChange={(event) => setPriceRetail(Math.max(0, Number(event.target.value) || 0))}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-discount-rate">할인율(%)</Label>
          <Input
            id="manual-discount-rate"
            type="number"
            min={0}
            max={100}
            step={1}
            value={discountRate}
            disabled={disabled}
            placeholder="없으면 비워두세요"
            onChange={(event) => setDiscountRate(event.target.value)}
          />
        </div>
      </div>

      {previewUnitPrice !== null && (
        <p className="text-xs text-muted-foreground">
          적용 단가:{" "}
          <span className="font-medium text-foreground">
            ₩{previewUnitPrice.toLocaleString("ko-KR")}
          </span>
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="button" onClick={handleSubmit} disabled={disabled} className="self-start">
        <Plus className="size-4" />
        견적 목록에 추가
      </Button>
    </div>
  );
}
