"use client";

import * as React from "react";
import { CheckCircle2, Loader2, Plus, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { matchesKoreanSearch } from "@/lib/hangul";

export interface PolicyRow {
  brand: string;
  aliases: string[];
  rate_retail: number;
  rate_instructor: number;
  rate_center: number;
  rate_cost: number;
}

/** "SCUBAPRO, 스쿠버프로" 같은 콤마 구분 입력을 별칭 배열로 정규화. */
function parseAliasesInput(text: string): string[] {
  return text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const RATE_FIELDS: {
  key: keyof Pick<PolicyRow, "rate_retail" | "rate_instructor" | "rate_center" | "rate_cost">;
  label: string;
}[] = [
  { key: "rate_retail", label: "소비자가 할인율" },
  { key: "rate_instructor", label: "샵가 할인율" },
  { key: "rate_center", label: "공급가 할인율" },
  { key: "rate_cost", label: "원가 할인율" },
];

type RowStatus = "idle" | "saving" | "saved" | "error";

interface RowState {
  values: PolicyRow;
  status: RowStatus;
  errorMsg: string | null;
}

function RateInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}</span>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          step={0.01}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            if (!isNaN(n) && n >= 0 && n <= 100) onChange(n);
          }}
          className="pr-6 text-right"
          aria-label={label}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
}

export function DiscountPolicyTable({
  initialPolicies,
  allBrands,
  isAdmin,
}: {
  initialPolicies: PolicyRow[];
  allBrands: string[];
  /** 관리자 모드 여부 — 원가 할인율 조회, 수정/저장/삭제/추가는 관리자 모드에서만 가능하다. */
  isAdmin: boolean;
}) {
  const visibleRateFields = isAdmin
    ? RATE_FIELDS
    : RATE_FIELDS.filter((f) => f.key !== "rate_cost");
  const [rows, setRows] = React.useState<RowState[]>(() =>
    initialPolicies.map((p) => ({ values: { ...p }, status: "idle", errorMsg: null }))
  );
  const [showAddForm, setShowAddForm] = React.useState(false);
  const [newBrand, setNewBrand] = React.useState("");
  const [newAliasesText, setNewAliasesText] = React.useState("");
  const [newRates, setNewRates] = React.useState<
    Pick<PolicyRow, "rate_retail" | "rate_instructor" | "rate_center" | "rate_cost">
  >({
    rate_retail: 0,
    rate_instructor: 0,
    rate_center: 0,
    rate_cost: 0,
  });
  const [addStatus, setAddStatus] = React.useState<RowStatus>("idle");
  const [addError, setAddError] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [deleteTarget, setDeleteTarget] = React.useState<string | null>(null);

  const existingBrands = new Set(rows.map((r) => r.values.brand));
  const suggestedBrands = allBrands.filter((b) => !existingBrands.has(b));
  const suggestedBrandOptions: ComboboxOption[] = suggestedBrands.map((b) => ({
    value: b,
    label: b,
  }));

  // 브랜드명 자체뿐 아니라 별칭(예: "SCUBAPRO"/"Scubapro")으로도 찾을 수 있게
  // 대소문자·한/영 표기를 가리지 않고 매칭한다(matchesKoreanSearch 는 대소문자·
  // 공백 차이는 무시하지만, 한글⇄영문 자동 번역은 아니라 별칭에 등록된
  // 표기와 일치할 때만 찾아진다).
  const filteredRows = React.useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return rows;
    return rows.filter(
      (row) =>
        matchesKoreanSearch(row.values.brand, query) ||
        row.values.aliases.some((alias) => matchesKoreanSearch(alias, query))
    );
  }, [rows, searchQuery]);

  // 검색창은 기본적으로 "이미 할인율이 등록된 브랜드"만 찾는다(filteredRows).
  // 장비 마스터에는 있지만 아직 할인율을 한 번도 설정한 적 없는 브랜드는
  // rows 에 없어 검색해도 안 보였다 — 그래서 여기서 따로 찾아 보여주고
  // 바로 추가할 수 있게 한다.
  const unconfiguredMatches = React.useMemo(() => {
    const query = searchQuery.trim();
    if (!query) return [];
    return suggestedBrands.filter((brand) => matchesKoreanSearch(brand, query));
  }, [suggestedBrands, searchQuery]);

  const startAddingBrand = (brand: string) => {
    setNewBrand(brand);
    setAddError(null);
    setShowAddForm(true);
  };

  const updateRow = (
    brand: string,
    key: keyof Pick<PolicyRow, "rate_retail" | "rate_instructor" | "rate_center" | "rate_cost">,
    value: number
  ) => {
    setRows((prev) =>
      prev.map((r) =>
        r.values.brand === brand
          ? { ...r, values: { ...r.values, [key]: value }, status: "idle", errorMsg: null }
          : r
      )
    );
  };

  const updateRowAliases = (brand: string, text: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.values.brand === brand
          ? {
              ...r,
              values: { ...r.values, aliases: parseAliasesInput(text) },
              status: "idle",
              errorMsg: null,
            }
          : r
      )
    );
  };

  const saveRow = async (brand: string) => {
    const row = rows.find((r) => r.values.brand === brand);
    if (!row) return;
    setRows((prev) =>
      prev.map((r) => (r.values.brand === brand ? { ...r, status: "saving" } : r))
    );
    try {
      const res = await fetch("/api/discount-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(row.values),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "저장 실패");
      }
      setRows((prev) =>
        prev.map((r) => (r.values.brand === brand ? { ...r, status: "saved", errorMsg: null } : r))
      );
    } catch (error) {
      setRows((prev) =>
        prev.map((r) =>
          r.values.brand === brand
            ? { ...r, status: "error", errorMsg: error instanceof Error ? error.message : "오류" }
            : r
        )
      );
    }
  };

  const deleteRow = async (brand: string) => {
    setRows((prev) =>
      prev.map((r) => (r.values.brand === brand ? { ...r, status: "saving" } : r))
    );
    try {
      const res = await fetch(
        `/api/discount-policies/${encodeURIComponent(brand)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("삭제 실패");
      setRows((prev) => prev.filter((r) => r.values.brand !== brand));
    } catch (error) {
      setRows((prev) =>
        prev.map((r) =>
          r.values.brand === brand
            ? { ...r, status: "error", errorMsg: error instanceof Error ? error.message : "오류" }
            : r
        )
      );
      throw error;
    }
  };

  const addPolicy = async () => {
    if (!newBrand.trim()) {
      setAddError("브랜드명을 입력해주세요.");
      return;
    }
    setAddStatus("saving");
    setAddError(null);
    try {
      const res = await fetch("/api/discount-policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: newBrand.trim(),
          aliases: parseAliasesInput(newAliasesText),
          ...newRates,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "저장 실패");
      }
      const saved = await res.json();
      setRows((prev) => [
        ...prev,
        { values: saved as PolicyRow, status: "saved", errorMsg: null },
      ]);
      setNewBrand("");
      setNewAliasesText("");
      setNewRates({ rate_retail: 0, rate_instructor: 0, rate_center: 0, rate_cost: 0 });
      setShowAddForm(false);
      setAddStatus("idle");
    } catch (error) {
      setAddStatus("error");
      setAddError(error instanceof Error ? error.message : "오류");
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 브랜드 검색 — 대소문자/공백 무시, 별칭(예: SCUBAPRO/scubapro)도 함께 찾는다 */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="브랜드 검색 (예: scubapro, 스쿠버프로)"
          className="pl-9"
          aria-label="브랜드 검색"
        />
      </div>

      {!isAdmin && (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          관리자 모드에서만 원가 할인율을 확인하고, 수정/저장/추가/삭제할 수 있습니다.
        </p>
      )}

      {/* 헤더 */}
      <div
        className={cn(
          "hidden gap-3 rounded-t-lg border-b pb-2 sm:grid",
          isAdmin
            ? "grid-cols-[1fr_repeat(4,minmax(0,1fr))_auto]"
            : "grid-cols-[1fr_repeat(3,minmax(0,1fr))_auto]"
        )}
      >
        <span className="text-xs font-medium text-muted-foreground">브랜드</span>
        {visibleRateFields.map((f) => (
          <span key={f.key} className="text-xs font-medium text-muted-foreground text-right">
            {f.label}
          </span>
        ))}
        <span />
      </div>

      {rows.length === 0 && !showAddForm && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          등록된 할인율 정책이 없습니다. 아래 버튼으로 브랜드를 추가하세요.
        </p>
      )}

      {rows.length > 0 && filteredRows.length === 0 && unconfiguredMatches.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          &quot;{searchQuery}&quot;와 일치하는 브랜드가 없습니다.
        </p>
      )}

      {/* 장비 마스터에는 있지만 할인율을 아직 설정한 적 없는 브랜드 — 검색어와
          일치하면 여기 보여주고 바로 추가할 수 있게 한다. */}
      {unconfiguredMatches.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-dashed p-4">
          <p className="text-xs text-muted-foreground">
            장비 목록에는 있지만 아직 할인율이 설정되지 않은 브랜드입니다.
          </p>
          {unconfiguredMatches.map((brand) =>
            isAdmin ? (
              <Button
                key={brand}
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => startAddingBrand(brand)}
              >
                <Plus className="size-4" />
                {brand} 할인율 설정하기
              </Button>
            ) : (
              <span key={brand} className="text-sm font-medium">
                {brand}
              </span>
            )
          )}
        </div>
      )}

      {/* 행 목록 */}
      {filteredRows.map((row) => (
        <div key={row.values.brand} className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">{row.values.brand}</span>
            <div className="flex items-center gap-2">
              {row.status === "saved" && (
                <span className="flex items-center gap-1 text-xs text-emerald-600">
                  <CheckCircle2 className="size-3.5" />
                  저장됨
                </span>
              )}
              {row.status === "error" && (
                <span className="flex items-center gap-1 text-xs text-destructive">
                  <XCircle className="size-3.5" />
                  {row.errorMsg}
                </span>
              )}
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  disabled={row.status === "saving"}
                  onClick={() => setDeleteTarget(row.values.brand)}
                  aria-label={`${row.values.brand} 삭제`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">
              별칭 (장비 마스터에서 다른 이름/대소문자로 쓰이면 콤마로 구분해 추가)
            </span>
            <Input
              value={row.values.aliases.join(", ")}
              disabled={!isAdmin || row.status === "saving"}
              placeholder="예: SCUBAPRO, 스쿠버프로"
              onChange={(e) => updateRowAliases(row.values.brand, e.target.value)}
              aria-label={`${row.values.brand} 별칭`}
            />
          </div>

          <div className={cn("grid grid-cols-2 gap-3", isAdmin ? "sm:grid-cols-4" : "sm:grid-cols-3")}>
            {visibleRateFields.map((f) => (
              <RateInput
                key={f.key}
                label={f.label}
                value={row.values[f.key]}
                disabled={!isAdmin || row.status === "saving"}
                onChange={(v) => updateRow(row.values.brand, f.key, v)}
              />
            ))}
          </div>

          {isAdmin && (
            <Button
              size="sm"
              disabled={row.status === "saving"}
              onClick={() => saveRow(row.values.brand)}
              className={cn("self-start", row.status === "saving" && "opacity-70")}
            >
              {row.status === "saving" && <Loader2 className="animate-spin" />}
              저장
            </Button>
          )}
        </div>
      ))}

      {/* 새 브랜드 추가 폼 (관리자 모드 전용) */}
      {isAdmin && showAddForm && (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">브랜드</span>
            <Combobox
              options={suggestedBrandOptions}
              value={newBrand}
              onChange={(v) => {
                setNewBrand(v);
                setAddError(null);
              }}
              allowCustomValue
              placeholder="브랜드를 검색하거나 새로 입력하세요"
              searchPlaceholder="브랜드 검색..."
              emptyMessage="일치하는 브랜드가 없습니다."
            />
            {addError && (
              <p className="text-xs text-destructive">{addError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              별칭 (선택, 콤마로 구분)
            </span>
            <Input
              value={newAliasesText}
              placeholder="예: SCUBAPRO, 스쿠버프로"
              disabled={addStatus === "saving"}
              onChange={(e) => setNewAliasesText(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {RATE_FIELDS.map((f) => (
              <RateInput
                key={f.key}
                label={f.label}
                value={newRates[f.key]}
                disabled={addStatus === "saving"}
                onChange={(v) => setNewRates((prev) => ({ ...prev, [f.key]: v }))}
              />
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={addStatus === "saving"}
              onClick={addPolicy}
            >
              {addStatus === "saving" && <Loader2 className="animate-spin" />}
              추가
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowAddForm(false);
                setAddError(null);
              }}
            >
              취소
            </Button>
          </div>
        </div>
      )}

      {isAdmin && !showAddForm && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => setShowAddForm(true)}
        >
          <Plus className="size-4" />
          브랜드 추가
        </Button>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`"${deleteTarget ?? ""}" 할인율 정책을 삭제할까요?`}
        description="삭제하면 이 브랜드의 할인율 설정이 모두 사라집니다."
        onConfirm={() => {
          if (deleteTarget) return deleteRow(deleteTarget);
        }}
      />
    </div>
  );
}
