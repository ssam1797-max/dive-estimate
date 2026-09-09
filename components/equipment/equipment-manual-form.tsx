"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandField } from "@/components/equipment/brand-field";
import { CategoryField } from "@/components/equipment/category-field";
import { TagInput } from "@/components/equipment/tag-input";

interface EquipmentManualFormProps {
  initialBrands: string[];
  brandsLoadError?: boolean;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i);

const EMPTY_FORM = {
  brand: "",
  category: "",
  name: "",
  priceRetail: "",
  colors: [] as string[],
  sizes: [] as string[],
  catalogYear: CURRENT_YEAR,
};

export function EquipmentManualForm({
  initialBrands,
  brandsLoadError,
}: EquipmentManualFormProps) {
  const [brands] = React.useState(initialBrands);
  const [form, setForm] = React.useState(EMPTY_FORM);
  const [errors, setErrors] = React.useState<Partial<Record<keyof typeof EMPTY_FORM, string>>>({});

  const [status, setStatus] = React.useState<SubmitStatus>("idle");
  const [feedback, setFeedback] = React.useState<string | null>(null);

  const isSubmitting = status === "submitting";

  const set = <K extends keyof typeof EMPTY_FORM>(key: K, value: (typeof EMPTY_FORM)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.brand.trim()) next.brand = "브랜드를 입력하거나 선택해주세요.";
    if (!form.category.trim()) next.category = "카테고리를 선택하거나 입력해주세요.";
    if (!form.name.trim()) next.name = "모델명을 입력해주세요.";
    const price = Number(form.priceRetail);
    if (form.priceRetail === "" || isNaN(price) || price < 0)
      next.priceRetail = "소비자 가격을 올바르게 입력해주세요. (0 이상 숫자)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    if (!validate()) return;

    setStatus("submitting");
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: form.brand.trim(),
          category: form.category.trim(),
          name: form.name.trim(),
          price_retail: Number(form.priceRetail),
          colors: form.colors,
          sizes: form.sizes,
          catalog_year: form.catalogYear,
        }),
      });

      const data: unknown = await res.json();

      if (!res.ok) {
        const message =
          data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : `요청이 실패했습니다. (status ${res.status})`;
        throw new Error(message);
      }

      setStatus("success");
      setFeedback(`${form.brand} · ${form.name} 이(가) 성공적으로 등록되었습니다.`);
      setForm({ ...EMPTY_FORM, brand: form.brand, catalogYear: form.catalogYear });
    } catch (error) {
      setStatus("error");
      setFeedback(
        error instanceof Error ? error.message : "장비 등록 중 오류가 발생했습니다."
      );
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>장비 정보 입력</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
          {brandsLoadError && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              기존 브랜드 목록을 불러오지 못했습니다. 브랜드명을 직접 입력해주세요.
            </p>
          )}

          {/* 브랜드 · 카테고리 */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <BrandField
                brands={brands}
                value={form.brand}
                onChange={(v) => set("brand", v)}
                disabled={isSubmitting}
              />
              {errors.brand && (
                <p className="text-xs text-destructive">{errors.brand}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <CategoryField
                value={form.category}
                onChange={(v) => set("category", v)}
                disabled={isSubmitting}
              />
              {errors.category && (
                <p className="text-xs text-destructive">{errors.category}</p>
              )}
            </div>
          </div>

          {/* 모델명 · 소비자가격 */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="equipment-name">모델명</Label>
              <Input
                id="equipment-name"
                value={form.name}
                disabled={isSubmitting}
                placeholder="예: Hydros Pro"
                onChange={(e) => set("name", e.target.value)}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="price-retail">소비자 가격 (원)</Label>
              <Input
                id="price-retail"
                type="number"
                inputMode="numeric"
                min={0}
                value={form.priceRetail}
                disabled={isSubmitting}
                placeholder="예: 1200000"
                onChange={(e) => set("priceRetail", e.target.value)}
              />
              {errors.priceRetail && (
                <p className="text-xs text-destructive">{errors.priceRetail}</p>
              )}
            </div>
          </div>

          {/* 색상 · 사이즈 */}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="colors">색상 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <TagInput
                id="colors"
                tags={form.colors}
                onTagsChange={(v) => set("colors", v)}
                disabled={isSubmitting}
                placeholder="입력 후 Enter 또는 쉼표로 추가"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="sizes">사이즈 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <TagInput
                id="sizes"
                tags={form.sizes}
                onTagsChange={(v) => set("sizes", v)}
                disabled={isSubmitting}
                placeholder="예: XS, S, M, L, XL"
              />
            </div>
          </div>

          {/* 카탈로그 연도 */}
          <div className="flex flex-col gap-2 sm:w-1/2">
            <Label htmlFor="manual-catalog-year">카탈로그 연도 <span className="text-muted-foreground font-normal">(선택)</span></Label>
            <Select
              id="manual-catalog-year"
              value={form.catalogYear}
              disabled={isSubmitting}
              onChange={(e) => set("catalogYear", Number(e.target.value))}
            >
              {YEAR_OPTIONS.map((year) => (
                <option key={year} value={year}>
                  {year}년
                </option>
              ))}
            </Select>
          </div>

          {/* 피드백 */}
          {feedback && status === "success" && (
            <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              {feedback}
            </div>
          )}
          {feedback && status === "error" && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <XCircle className="mt-0.5 size-4 shrink-0" />
              {feedback}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="self-start">
            {isSubmitting && <Loader2 className="animate-spin" />}
            {isSubmitting ? "저장 중..." : "장비 등록"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
