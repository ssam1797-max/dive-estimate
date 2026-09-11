"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { BrandField } from "@/components/equipment/brand-field";
import { CategoryField } from "@/components/equipment/category-field";
import { TagInput } from "@/components/equipment/tag-input";
import {
  PRICE_TIERS,
  PRICE_TIER_LABELS,
  buildDiscountPolicyMap,
  calculateEffectiveUnitPrice,
  calculateDiscountRate,
  formatDiscountRate,
  type DiscountPolicyMap,
} from "@/lib/estimates/pricing";

interface EquipmentEditDialogProps {
  equipmentId: string;
  initialBrands: string[];
  onOpenChange: (open: boolean) => void;
  /** 저장(수정) 성공 후 목록을 새로고침하도록 부모에 알린다. */
  onSaved: () => void;
}

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i);

interface FormState {
  brand: string;
  category: string;
  name: string;
  priceRetail: string;
  colors: string[];
  sizes: string[];
  catalogYear: number | null;
}

function fmtWon(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

/**
 * 소비자가격 입력값과 브랜드 할인율 정책으로 4개 등급의 실제 단가를 즉시
 * 다시 계산해 보여준다 — 장비 마스터의 소비자가격(price_retail)을 고치면
 * 이후 이 장비를 담는 모든 견적서가 새 가격 기준으로 계산되므로(estimate
 * 작성 화면이 매번 calculateEffectiveUnitPrice 를 그 자리에서 호출한다),
 * 저장 전에 그 결과를 브랜드별 할인율 그대로 미리 확인할 수 있게 한다.
 */
function DiscountPreview({
  priceRetail,
  brand,
  discountMap,
}: {
  priceRetail: number;
  brand: string;
  discountMap: DiscountPolicyMap;
}) {
  if (!brand.trim() || priceRetail <= 0) {
    return (
      <p className="text-xs text-muted-foreground">
        브랜드와 소비자 가격을 입력하면 등급별 실제 단가를 미리 볼 수 있습니다.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {PRICE_TIERS.map((tier) => {
        const price = calculateEffectiveUnitPrice(priceRetail, brand, tier, discountMap);
        const rate = calculateDiscountRate(priceRetail, price);
        return (
          <div key={tier} className="rounded-md border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground">{PRICE_TIER_LABELS[tier]}</p>
            <p className="text-sm font-semibold">{fmtWon(price)}원</p>
            {rate > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                -{formatDiscountRate(rate)}%
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EquipmentEditDialog({
  equipmentId,
  initialBrands,
  onOpenChange,
  onSaved,
}: EquipmentEditDialogProps) {
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [discountMap, setDiscountMap] = React.useState<DiscountPolicyMap>({});
  const [errors, setErrors] = React.useState<Partial<Record<keyof FormState, string>>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const [equipmentRes, policiesRes] = await Promise.all([
          fetch(`/api/equipment/${equipmentId}`),
          fetch("/api/discount-policies"),
        ]);

        const equipmentData: unknown = await equipmentRes.json();
        if (!equipmentRes.ok) {
          const message =
            equipmentData && typeof equipmentData === "object" && "error" in equipmentData
              ? String((equipmentData as { error: unknown }).error)
              : "장비 정보를 불러오지 못했습니다.";
          throw new Error(message);
        }

        const policiesData: unknown = policiesRes.ok ? await policiesRes.json() : [];
        const policies = Array.isArray(policiesData) ? policiesData : [];

        if (cancelled) return;

        const eq = equipmentData as {
          brand: string;
          category: string;
          name: string;
          price_retail: number;
          colors: string[];
          sizes: string[];
          catalog_year: number | null;
        };

        setForm({
          brand: eq.brand,
          category: eq.category,
          name: eq.name,
          priceRetail: String(eq.price_retail),
          colors: eq.colors,
          sizes: eq.sizes,
          catalogYear: eq.catalog_year,
        });
        setDiscountMap(
          buildDiscountPolicyMap(
            policies as {
              brand: string;
              aliases: string[];
              rate_retail: number;
              rate_instructor: number;
              rate_center: number;
              rate_cost: number;
            }[]
          )
        );
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "장비 정보를 불러오지 못했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [equipmentId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (current: FormState): boolean => {
    const next: typeof errors = {};
    if (!current.brand.trim()) next.brand = "브랜드를 입력하거나 선택해주세요.";
    if (!current.category.trim()) next.category = "카테고리를 선택하거나 입력해주세요.";
    if (!current.name.trim()) next.name = "모델명을 입력해주세요.";
    const price = Number(current.priceRetail);
    if (current.priceRetail === "" || Number.isNaN(price) || price < 0)
      next.priceRetail = "소비자 가격을 올바르게 입력해주세요. (0 이상 숫자)";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form) return;
    setSubmitError(null);
    if (!validate(form)) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/equipment/${equipmentId}`, {
        method: "PUT",
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
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : `요청이 실패했습니다. (status ${res.status})`;
        throw new Error(message);
      }
      onSaved();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "장비 수정 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const priceRetailNumber = form ? Number(form.priceRetail) || 0 : 0;

  return (
    <Dialog open onOpenChange={onOpenChange} widthClassName="max-w-lg">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>장비 정보 수정</DialogTitle>
          <DialogDescription>
            소비자 가격을 바꾸면 앞으로 이 장비를 담는 견적서부터 새 가격과 브랜드
            할인율로 다시 계산됩니다. 이미 저장된 과거 견적서의 단가는 바뀌지 않습니다.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            불러오는 중...
          </div>
        )}

        {!loading && loadError && (
          <p className="text-sm text-destructive">{loadError}</p>
        )}

        {!loading && !loadError && form && (
          <form className="flex flex-col gap-5" onSubmit={handleSubmit} noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <BrandField
                  brands={initialBrands}
                  value={form.brand}
                  onChange={(v) => set("brand", v)}
                  disabled={isSubmitting}
                />
                {errors.brand && <p className="text-xs text-destructive">{errors.brand}</p>}
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

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-equipment-name">모델명</Label>
                <Input
                  id="edit-equipment-name"
                  value={form.name}
                  disabled={isSubmitting}
                  onChange={(e) => set("name", e.target.value)}
                />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-price-retail">소비자 가격 (원)</Label>
                <Input
                  id="edit-price-retail"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={form.priceRetail}
                  disabled={isSubmitting}
                  onChange={(e) => set("priceRetail", e.target.value)}
                />
                {errors.priceRetail && (
                  <p className="text-xs text-destructive">{errors.priceRetail}</p>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>등급별 실제 단가 미리보기</Label>
              <DiscountPreview
                priceRetail={priceRetailNumber}
                brand={form.brand}
                discountMap={discountMap}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-colors">
                  색상 <span className="text-muted-foreground font-normal">(선택)</span>
                </Label>
                <TagInput
                  id="edit-colors"
                  tags={form.colors}
                  onTagsChange={(v) => set("colors", v)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-sizes">
                  사이즈 <span className="text-muted-foreground font-normal">(선택)</span>
                </Label>
                <TagInput
                  id="edit-sizes"
                  tags={form.sizes}
                  onTagsChange={(v) => set("sizes", v)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:w-1/2">
              <Label htmlFor="edit-catalog-year">
                카탈로그 연도 <span className="text-muted-foreground font-normal">(선택)</span>
              </Label>
              <Select
                id="edit-catalog-year"
                value={form.catalogYear ?? ""}
                disabled={isSubmitting}
                onChange={(e) =>
                  set("catalogYear", e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">선택 안 함</option>
                {YEAR_OPTIONS.map((year) => (
                  <option key={year} value={year}>
                    {year}년
                  </option>
                ))}
              </Select>
            </div>

            {submitError && <p className="text-sm text-destructive">{submitError}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isSubmitting ? "저장 중..." : "저장"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
