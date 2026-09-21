"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";

interface BrandFieldProps {
  brands: string[];
  value: string;
  onChange: (brand: string) => void;
  disabled?: boolean;
}

/**
 * 브랜드를 검색해서 기존 목록에서 선택하거나, 목록에 없으면 그 자리에서
 * 신규 브랜드명을 입력해 등록할 수 있는 필드. 기존에는 "기존 목록에서
 * 선택" / "신규 입력" 을 별도 모드 토글(링크 버튼)로 전환해야 했는데,
 * Combobox(allowCustomValue)로 통합해 검색만으로 두 가지가 다 되게 했다
 * (브랜드 할인율 설정 화면·견적서 품목 직접 추가에서 이미 쓰는 것과 같은 패턴).
 */
export function BrandField({
  brands,
  value,
  onChange,
  disabled,
}: BrandFieldProps) {
  const brandOptions: ComboboxOption[] = React.useMemo(
    () => brands.map((brand) => ({ value: brand, label: brand })),
    [brands]
  );

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="brand-field">브랜드</Label>
      <Combobox
        id="brand-field"
        options={brandOptions}
        value={value}
        onChange={onChange}
        allowCustomValue
        placeholder="브랜드를 검색하거나 새로 입력하세요"
        searchPlaceholder="브랜드 검색..."
        emptyMessage="등록된 브랜드가 없습니다."
        disabled={disabled}
      />
    </div>
  );
}
