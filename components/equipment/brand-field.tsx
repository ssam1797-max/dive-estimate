"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface BrandFieldProps {
  brands: string[];
  value: string;
  onChange: (brand: string) => void;
  disabled?: boolean;
}

/**
 * 브랜드를 기존 목록에서 선택하거나, 신규 브랜드명을 직접 입력할 수 있는 필드.
 */
export function BrandField({
  brands,
  value,
  onChange,
  disabled,
}: BrandFieldProps) {
  const [mode, setMode] = React.useState<"existing" | "new">(
    brands.length > 0 ? "existing" : "new"
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="brand-field">브랜드</Label>
        {brands.length > 0 && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            disabled={disabled}
            onClick={() => {
              const nextMode = mode === "existing" ? "new" : "existing";
              setMode(nextMode);
              onChange("");
            }}
          >
            {mode === "existing" ? "신규 브랜드 입력하기" : "기존 브랜드에서 선택하기"}
          </Button>
        )}
      </div>

      {mode === "existing" ? (
        <Select
          id="brand-field"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="" disabled>
            브랜드를 선택하세요
          </option>
          {brands.map((brand) => (
            <option key={brand} value={brand}>
              {brand}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id="brand-field"
          value={value}
          disabled={disabled}
          placeholder="예: Scubapro"
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </div>
  );
}
