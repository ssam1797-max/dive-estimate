"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
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
 *
 * brands 목록이 비어 있으면(서버에서 브랜드 목록을 못 불러온 경우 포함)
 * Combobox 대신 평범한 텍스트 입력으로 바꾼다 — 검색할 대상이 아예 없을
 * 때는 "새로 추가" 버튼도 사용자가 검색창에 뭔가 입력해야만 나타나서,
 * 목록이 비어 있는 드롭다운만 보고는 신규 브랜드를 어떻게 넣어야 하는지
 * 알기 어렵다(예전 "신규 입력" 모드와 동일하게, 클릭 한 번 없이 바로 타이핑).
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

  if (brands.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor="brand-field">브랜드</Label>
        <Input
          id="brand-field"
          value={value}
          disabled={disabled}
          placeholder="예: Scubapro"
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

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
