"use client";

import * as React from "react";
import { Loader2, Pencil, Search, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EquipmentEditDialog } from "@/components/equipment/equipment-edit-dialog";
import type { EquipmentCatalogItem } from "@/lib/estimates/types";

interface EquipmentListManagerProps {
  initialBrands: string[];
  brandsLoadError?: boolean;
}

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

/** 검색어 입력마다 바로 요청하지 않고, 타이핑이 잠시 멈췄을 때만 요청한다. */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function EquipmentListManager({
  initialBrands,
  brandsLoadError,
}: EquipmentListManagerProps) {
  const [query, setQuery] = React.useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [results, setResults] = React.useState<EquipmentCatalogItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  // useTransition 의 isPending 을 로딩 표시로 쓴다 — startTransition 에 넘긴
  // 비동기 콜백이 끝날 때까지 자동으로 true 를 유지해주므로(React 19),
  // effect 안에서 직접 setLoading(true/false) 를 호출할 필요가 없다
  // (react-hooks/set-state-in-effect 가 금지하는 패턴).
  const [isPending, startTransition] = React.useTransition();

  const [editTargetId, setEditTargetId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<EquipmentCatalogItem | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);

  // 검색 실행: 디바운스된 검색어가 바뀔 때뿐 아니라, 수정 다이얼로그 저장 후
  // 목록을 새로고침할 때도 이 값을 증가시켜 아래 effect를 다시 돈다.
  const [refreshKey, setRefreshKey] = React.useState(0);
  const loading = isPending;

  React.useEffect(() => {
    const trimmed = debouncedQuery.trim();
    // 검색어가 비어 있으면 fetch 자체를 시작하지 않는다 — 화면 렌더링 쪽에서
    // 이미 `query.trim() === ""` 일 때는 results/error 상태를 아예 참조하지
    // 않으므로, 남아 있는 이전 상태를 여기서 굳이 지울 필요가 없다.
    if (!trimmed) return;

    let cancelled = false;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/equipment/search?q=${encodeURIComponent(trimmed)}`);
        const data: unknown = await res.json();
        if (!res.ok) {
          const message =
            data && typeof data === "object" && "error" in data
              ? String((data as { error: unknown }).error)
              : "검색 중 오류가 발생했습니다.";
          throw new Error(message);
        }
        if (cancelled) return;
        const items = (data as { items?: EquipmentCatalogItem[] }).items ?? [];
        setResults(items);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "검색 중 오류가 발생했습니다.");
        setResults([]);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, refreshKey, startTransition]);

  const handleDelete = async (item: EquipmentCatalogItem) => {
    setRowError(null);
    const res = await fetch(`/api/equipment/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data: unknown = await res.json().catch(() => null);
      const message =
        data && typeof data === "object" && "error" in data
          ? String((data as { error: unknown }).error)
          : "장비 삭제 중 오류가 발생했습니다.";
      setRowError(message);
      throw new Error(message);
    }
    setResults((prev) => prev.filter((r) => r.id !== item.id));
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>장비 검색</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {brandsLoadError && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
              브랜드 목록을 불러오지 못했습니다. 수정 시 브랜드명을 직접 입력해주세요.
            </p>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="브랜드, 카테고리, 모델명으로 검색"
              className="pl-9"
            />
          </div>

          {rowError && <p className="text-sm text-destructive">{rowError}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}

          {loading && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              검색 중...
            </div>
          )}

          {!loading && !error && query.trim() === "" && (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              검색어를 입력하면 등록된 장비 목록이 표시됩니다.
            </p>
          )}

          {!loading && !error && query.trim() !== "" && results.length === 0 && (
            <p className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
              검색 결과가 없습니다.
            </p>
          )}

          {!loading && query.trim() !== "" && results.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">브랜드</th>
                    <th className="py-2 pr-2 font-medium">카테고리</th>
                    <th className="py-2 pr-2 font-medium">모델명</th>
                    <th className="py-2 pr-2 font-medium">소비자가격</th>
                    <th className="py-2 pr-2 font-medium">색상 / 사이즈</th>
                    <th className="py-2 pr-2 font-medium text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 align-top text-muted-foreground">{item.brand}</td>
                      <td className="py-2 pr-2 align-top text-muted-foreground">
                        {item.category}
                      </td>
                      <td className="py-2 pr-2 align-top font-medium">{item.name}</td>
                      <td className="py-2 pr-2 align-top">{formatCurrency(item.price_retail)}</td>
                      <td className="py-2 pr-2 align-top text-muted-foreground">
                        {(item.colors.length > 0 ? item.colors.join(", ") : "-") +
                          " / " +
                          (item.sizes.length > 0 ? item.sizes.join(", ") : "-")}
                      </td>
                      <td className="py-2 pr-2 align-top text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setEditTargetId(item.id)}
                          aria-label={`${item.name} 수정`}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(item)}
                          aria-label={`${item.name} 삭제`}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editTargetId && (
        <EquipmentEditDialog
          equipmentId={editTargetId}
          initialBrands={initialBrands}
          onOpenChange={(open) => {
            if (!open) setEditTargetId(null);
          }}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="이 장비를 삭제할까요?"
        description={
          deleteTarget
            ? `"${deleteTarget.brand} · ${deleteTarget.name}"을(를) 삭제합니다. 이미 저장된 견적서에서 사용 중이었다면 해당 항목은 "(삭제된 장비)"로 표시되며, 되돌릴 수 없습니다.`
            : undefined
        }
        onConfirm={() => {
          if (deleteTarget) return handleDelete(deleteTarget);
        }}
      />
    </div>
  );
}
