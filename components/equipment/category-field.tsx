"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { EQUIPMENT_CATEGORIES } from "@/lib/equipment/constants";

interface CategoryFieldProps {
  value: string;
  onChange: (category: string) => void;
  disabled?: boolean;
}

export function CategoryField({ value, onChange, disabled }: CategoryFieldProps) {
  const isCustom = value !== "" && !EQUIPMENT_CATEGORIES.includes(value as typeof EQUIPMENT_CATEGORIES[number]);
  const [mode, setMode] = React.useState<"select" | "custom">(isCustom ? "custom" : "select");

  const handleModeToggle = () => {
    const next = mode === "select" ? "custom" : "select";
    setMode(next);
    onChange("");
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="category-field">카테고리</Label>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs"
          disabled={disabled}
          onClick={handleModeToggle}
        >
          {mode === "select" ? "직접 입력하기" : "목록에서 선택하기"}
        </Button>
      </div>

      {mode === "select" ? (
        <Select
          id="category-field"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" disabled>
            카테고리를 선택하세요
          </option>
          {EQUIPMENT_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          id="category-field"
          value={value}
          disabled={disabled}
          placeholder="예: 수중 카메라"
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
