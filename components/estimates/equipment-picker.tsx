"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { EquipmentQuickSearch } from "@/components/estimates/equipment-quick-search";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { EquipmentCatalogItem, EstimateItemDraft } from "@/lib/estimates/types";
import {
  calculateEffectiveUnitPrice,
  type DiscountPolicyMap,
  type PriceTier,
} from "@/lib/estimates/pricing";
import { CATEGORY_SYNONYMS, type EQUIPMENT_CATEGORIES } from "@/lib/equipment/constants";
import { getKnownBrandAliases } from "@/lib/equipment/normalizeBrand";
import {
  getRecentBrands,
  getRecentCategories,
  getRecentEquipmentIds,
  getRecentUsageServerSnapshot,
  getRecentUsageSnapshot,
  recordEquipmentUsage,
  sortWithRecentFirst,
  subscribeRecentUsage,
} from "@/lib/estimates/recent-usage";

interface EquipmentPickerProps {
  catalog: EquipmentCatalogItem[];
  onAdd: (item: EstimateItemDraft) => void;
  priceTier: PriceTier;
  discountPolicies: DiscountPolicyMap;
  disabled?: boolean;
}

const NO_OPTION_VALUE = "__none__";

/**
 * 3단계 조건부 장비 선택 컴포넌트: 브랜드 → 카테고리 → 장비명 순으로
 * 선택지가 좁혀지고, 장비를 고르면 색상/사이즈/수량/비고를 입력해 담을 수 있습니다.
 */
export function EquipmentPicker({
  catalog,
  onAdd,
  priceTier,
  discountPolicies,
  disabled,
}: EquipmentPickerProps) {
  const [brand, setBrand] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [equipmentId, setEquipmentId] = React.useState("");
  const [color, setColor] = React.useState("");
  const [size, setSize] = React.useState("");
  const [quantity, setQuantity] = React.useState(1);
  const [itemRemarks, setItemRemarks] = React.useState("");

  // 최근 사용한 브랜드/카테고리/장비(localStorage 기록)를 드롭다운 맨 위로
  // 올리기 위한 외부 스토어 구독. 서버 렌더링에서는 항상 빈 배열을 쓰고,
  // 마운트 후에는 localStorage 값을 구독해 변경될 때만 재렌더링한다.
  const recentEntries = React.useSyncExternalStore(
    subscribeRecentUsage,
    getRecentUsageSnapshot,
    getRecentUsageServerSnapshot
  );
  const recentBrands = React.useMemo(() => getRecentBrands(recentEntries), [recentEntries]);
  const recentCategories = React.useMemo(
    () => (brand ? getRecentCategories(recentEntries, brand) : []),
    [recentEntries, brand]
  );
  const recentEquipmentIds = React.useMemo(
    () => (brand && category ? getRecentEquipmentIds(recentEntries, brand, category) : []),
    [recentEntries, brand, category]
  );

  const brandOptions: ComboboxOption[] = React.useMemo(() => {
    const unique = Array.from(new Set(catalog.map((item) => item.brand)));
    unique.sort((a, b) => a.localeCompare(b, "ko"));
    const options = unique.map((value) => {
      // 데이터는 표준 한글 표기로만 저장되지만("스쿠버프로"), 검색창에 영문
      // 표기("scubapro")를 입력해도 찾을 수 있도록 알려진 별칭을 검색 대상에 포함한다.
      const aliases = getKnownBrandAliases(value);
      return {
        value,
        label: value,
        description: aliases.length > 0 ? aliases.join(" ") : undefined,
      };
    });
    return sortWithRecentFirst(options, recentBrands, (o) => o.value);
  }, [catalog, recentBrands]);

  const categoryOptions: ComboboxOption[] = React.useMemo(() => {
    if (!brand) return [];
    const unique = Array.from(
      new Set(
        catalog.filter((item) => item.brand === brand).map((item) => item.category)
      )
    );
    unique.sort((a, b) => a.localeCompare(b, "ko"));
    const options = unique.map((value) => {
      // "레귤레이터"를 "호흡기"로 검색하는 것처럼, 표기 차이가 아니라 동의어라
      // 정규화로는 해결 안 되는 경우를 위해 알려진 동의어를 검색 대상에 포함한다.
      const synonyms = CATEGORY_SYNONYMS[value as (typeof EQUIPMENT_CATEGORIES)[number]];
      return {
        value,
        label: value,
        description: synonyms && synonyms.length > 0 ? synonyms.join(" ") : undefined,
      };
    });
    return sortWithRecentFirst(options, recentCategories, (o) => o.value);
  }, [catalog, brand, recentCategories]);

  const nameOptions: ComboboxOption[] = React.useMemo(() => {
    if (!brand || !category) return [];
    const options = catalog
      .filter((item) => item.brand === brand && item.category === category)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .map((item) => ({
        value: item.id,
        label: item.name,
        description: `₩${item.price_retail.toLocaleString("ko-KR")}`,
      }));
    return sortWithRecentFirst(options, recentEquipmentIds, (o) => o.value);
  }, [catalog, brand, category, recentEquipmentIds]);

  const selectedEquipment = React.useMemo(
    () => catalog.find((item) => item.id === equipmentId) ?? null,
    [catalog, equipmentId]
  );

  // 장비를 고르는 즉시 적용 단가(선택된 가격 티어 기준)를 미리 계산해 보여준다.
  const previewUnitPrice = React.useMemo(() => {
    if (!selectedEquipment) return null;
    return calculateEffectiveUnitPrice(
      selectedEquipment.price_retail,
      selectedEquipment.brand,
      priceTier,
      discountPolicies
    );
  }, [selectedEquipment, priceTier, discountPolicies]);

  const colorOptions = selectedEquipment?.colors ?? [];
  const sizeOptions = selectedEquipment?.sizes ?? [];

  const canAdd =
    Boolean(selectedEquipment) &&
    (colorOptions.length === 0 || color !== "") &&
    (sizeOptions.length === 0 || size !== "") &&
    quantity > 0;

  const handleBrandChange = (nextBrand: string) => {
    setBrand(nextBrand);
    setCategory("");
    setEquipmentId("");
    setColor("");
    setSize("");
  };

  const handleCategoryChange = (nextCategory: string) => {
    setCategory(nextCategory);
    setEquipmentId("");
    setColor("");
    setSize("");
  };

  const handleEquipmentChange = (nextEquipmentId: string) => {
    setEquipmentId(nextEquipmentId);
    setColor("");
    setSize("");
    setQuantity(1);
    setItemRemarks("");
  };

  /**
   * 상단 "키워드 통합 검색"에서 결과를 클릭했을 때 호출된다. 검색 자체는
   * 별도 API(/api/equipment/search)를 쓰지만, 선택된 장비를 3단계
   * 브랜드→카테고리→장비 폼의 기존 state(brand/category/equipmentId)에
   * 그대로 채워 넣기만 한다 — 색상/사이즈/수량 선택과 "견적 목록에 추가"
   * (handleAdd, 4개 등급 단가 계산 등)는 전부 기존 로직을 그대로 탄다.
   */
  const applyQuickSearchResult = (item: EquipmentCatalogItem) => {
    setBrand(item.brand);
    setCategory(item.category);
    setEquipmentId(item.id);
    setColor("");
    setSize("");
    setQuantity(1);
    setItemRemarks("");
  };

  const handleAdd = () => {
    if (!selectedEquipment || !canAdd) return;

    const unitPrice = calculateEffectiveUnitPrice(
      selectedEquipment.price_retail,
      selectedEquipment.brand,
      priceTier,
      discountPolicies
    );

    onAdd({
      clientId: crypto.randomUUID(),
      equipmentId: selectedEquipment.id,
      brand: selectedEquipment.brand,
      category: selectedEquipment.category,
      name: selectedEquipment.name,
      color,
      size,
      quantity,
      priceRetail: selectedEquipment.price_retail,
      unitPrice,
      itemRemarks,
    });

    // 최근 사용 기록 갱신 — 구독 중인 useSyncExternalStore 가 자동으로
    // 재렌더링을 트리거해 다음에 이 브랜드/카테고리를 열었을 때 방금 담은
    // 항목이 맨 위로 온다.
    recordEquipmentUsage({
      brand: selectedEquipment.brand,
      category: selectedEquipment.category,
      equipmentId: selectedEquipment.id,
    });

    // 같은 모델을 다른 색상/사이즈로 이어서 담기 좋도록 브랜드/카테고리/장비는 유지합니다.
    setColor("");
    setSize("");
    setQuantity(1);
    setItemRemarks("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>장비 추가</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label>키워드 통합 검색</Label>
          <EquipmentQuickSearch onSelect={applyQuickSearchResult} disabled={disabled} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>1. 브랜드</Label>
            <Combobox
              options={brandOptions}
              value={brand}
              onChange={handleBrandChange}
              placeholder="브랜드 선택"
              searchPlaceholder="브랜드 검색"
              emptyMessage="등록된 브랜드가 없습니다."
              disabled={disabled || brandOptions.length === 0}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>2. 카테고리</Label>
            <Combobox
              options={categoryOptions}
              value={category}
              onChange={handleCategoryChange}
              placeholder={brand ? "카테고리 선택" : "브랜드를 먼저 선택하세요"}
              searchPlaceholder="카테고리 검색"
              emptyMessage="해당 브랜드의 카테고리가 없습니다."
              disabled={disabled || !brand}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>3. 장비명</Label>
            <Combobox
              options={nameOptions}
              value={equipmentId}
              onChange={handleEquipmentChange}
              placeholder={category ? "장비 선택" : "카테고리를 먼저 선택하세요"}
              searchPlaceholder="장비명 검색"
              emptyMessage="해당 카테고리의 장비가 없습니다."
              disabled={disabled || !category}
            />
            {selectedEquipment && previewUnitPrice !== null && (
              <p className="text-xs text-muted-foreground">
                적용 단가:{" "}
                <span className="font-medium text-foreground">
                  ₩{previewUnitPrice.toLocaleString("ko-KR")}
                </span>
                {previewUnitPrice !== selectedEquipment.price_retail && (
                  <span className="ml-1 line-through">
                    ₩{selectedEquipment.price_retail.toLocaleString("ko-KR")}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="picker-color">색상</Label>
            <Select
              id="picker-color"
              value={color === "" ? NO_OPTION_VALUE : color}
              disabled={disabled || !selectedEquipment || colorOptions.length === 0}
              onChange={(event) =>
                setColor(
                  event.target.value === NO_OPTION_VALUE ? "" : event.target.value
                )
              }
            >
              <option value={NO_OPTION_VALUE} disabled={colorOptions.length > 0}>
                {colorOptions.length === 0 ? "해당 없음" : "색상을 선택하세요"}
              </option>
              {colorOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="picker-size">사이즈</Label>
            <Select
              id="picker-size"
              value={size === "" ? NO_OPTION_VALUE : size}
              disabled={disabled || !selectedEquipment || sizeOptions.length === 0}
              onChange={(event) =>
                setSize(
                  event.target.value === NO_OPTION_VALUE ? "" : event.target.value
                )
              }
            >
              <option value={NO_OPTION_VALUE} disabled={sizeOptions.length > 0}>
                {sizeOptions.length === 0 ? "해당 없음" : "사이즈를 선택하세요"}
              </option>
              {sizeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="picker-quantity">수량</Label>
            <Input
              id="picker-quantity"
              type="number"
              min={1}
              step={1}
              value={quantity}
              disabled={disabled || !selectedEquipment}
              onChange={(event) =>
                setQuantity(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="picker-remarks">항목 비고</Label>
            <Input
              id="picker-remarks"
              value={itemRemarks}
              disabled={disabled || !selectedEquipment}
              placeholder="예: 10% 할인"
              onChange={(event) => setItemRemarks(event.target.value)}
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={handleAdd}
          disabled={disabled || !canAdd}
          className="self-start"
        >
          <Plus />
          견적 목록에 추가
        </Button>
      </CardContent>
    </Card>
  );
}
