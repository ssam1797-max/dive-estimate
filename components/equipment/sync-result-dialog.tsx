"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, CheckCircle2, TrendingDown, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EquipmentImportSummary } from "@/lib/equipment/types";

interface SyncResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: EquipmentImportSummary;
  /** 가격 변동 검토 결과(퐁당가 반영/내 가격 유지)를 상위에 알려 토스트 등을 띄울 수 있게 한다. */
  onPriceApplied?: (updatedCount: number) => void;
  onPriceApplyError?: (message: string) => void;
  onDismissError?: (message: string) => void;
}

type Tab = "auto" | "review";

interface PriceChangedItem {
  id: string;
  name: string;
  category: string;
  oldPrice: number;
  newPrice: number;
}

function formatWon(value: number): string {
  return `${value.toLocaleString("ko-KR")}원`;
}

export function SyncResultDialog({
  open,
  onOpenChange,
  summary,
  onPriceApplied,
  onPriceApplyError,
  onDismissError,
}: SyncResultDialogProps) {
  const router = useRouter();
  const priceChangedItems = React.useMemo<PriceChangedItem[]>(
    () =>
      summary.items
        .filter(
          (item): item is typeof item & { id: string; oldPrice: number; newPrice: number } =>
            item.status === "protected" &&
            typeof item.id === "string" &&
            typeof item.oldPrice === "number" &&
            typeof item.newPrice === "number" &&
            item.oldPrice !== item.newPrice
        )
        .map((item) => ({
          id: item.id,
          name: item.name,
          category: item.category,
          oldPrice: item.oldPrice,
          newPrice: item.newPrice,
        })),
    [summary.items]
  );

  const autoItems = React.useMemo(
    () => summary.items.filter((item) => item.status === "inserted" || item.status === "updated"),
    [summary.items]
  );

  // summary 는 동기화 1회당 새 객체이므로(부모가 key={} 로 이 컴포넌트를
  // 매번 새로 마운트시킨다), lazy initializer만으로 "열릴 때 초기화"가
  // 보장된다 — effect로 리셋할 필요가 없다.
  const [tab, setTab] = React.useState<Tab>(() => (priceChangedItems.length > 0 ? "review" : "auto"));
  const [resolvedIds, setResolvedIds] = React.useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [applyingIds, setApplyingIds] = React.useState<Set<string>>(() => new Set());

  const pendingItems = priceChangedItems.filter((item) => !resolvedIds.has(item.id));

  const applyPrices = async (items: PriceChangedItem[]) => {
    if (items.length === 0) return;
    setApplyingIds((prev) => new Set([...prev, ...items.map((i) => i.id)]));
    try {
      const response = await fetch("/api/equipment/price-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: items.map((item) => ({ id: item.id, price: item.newPrice })),
        }),
      });
      const body = (await response.json()) as { ok: true; updatedIds: string[] } | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "가격 반영에 실패했습니다.");
      }
      setResolvedIds((prev) => new Set([...prev, ...body.updatedIds]));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        body.updatedIds.forEach((id) => next.delete(id));
        return next;
      });
      onPriceApplied?.(body.updatedIds.length);
      // "확인 필요 품목" 뱃지(상단 탭/현황 카드)가 즉시 줄어들도록 새로고침.
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "가격 반영 중 알 수 없는 오류가 발생했습니다.";
      onPriceApplyError?.(message);
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev);
        items.forEach((i) => next.delete(i.id));
        return next;
      });
    }
  };

  /**
   * "내 가격 유지"는 price_retail 을 바꾸지 않지만, "확인 필요" 대기 상태는
   * 서버에도 남아있으므로(pending_review_price) 반드시 dismiss API를 호출해
   * 비워야 한다 — 그렇지 않으면 이 다이얼로그를 닫은 뒤에도 "확인 필요
   * 품목" 탭에 계속 남아있게 된다.
   */
  const keepItems = async (items: PriceChangedItem[]) => {
    if (items.length === 0) return;
    setApplyingIds((prev) => new Set([...prev, ...items.map((i) => i.id)]));
    try {
      const response = await fetch("/api/equipment/price-review/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: items.map((item) => item.id) }),
      });
      const body = (await response.json()) as
        | { ok: true; dismissedIds: string[] }
        | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "확인 완료 처리에 실패했습니다.");
      }
      setResolvedIds((prev) => new Set([...prev, ...body.dismissedIds]));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        body.dismissedIds.forEach((id) => next.delete(id));
        return next;
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "확인 완료 처리 중 알 수 없는 오류가 발생했습니다.";
      onDismissError?.(message);
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev);
        items.forEach((i) => next.delete(i.id));
        return next;
      });
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedPendingItems = pendingItems.filter((item) => selectedIds.has(item.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange} widthClassName="max-w-2xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>
            {summary.brand} 동기화 완료
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 border-b">
          <button
            type="button"
            onClick={() => setTab("auto")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === "auto"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckCircle2 className="size-4" />
            자동 업데이트 완료 ({autoItems.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("review")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === "review"
                ? "border-destructive text-destructive"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertTriangle className="size-4" />
            🚨 가격 변동 확인 필요 ({pendingItems.length})
          </button>
        </div>

        {tab === "auto" ? (
          <div className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
            {autoItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                자동으로 반영된 품목이 없습니다.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {autoItems.map((item, index) => (
                  <li key={index}>
                    <Badge variant={item.status === "inserted" ? "success" : "secondary"} title={item.category}>
                      {item.name}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingItems.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                가격이 변동된 수동 품목이 없습니다.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
                  <p className="text-xs text-muted-foreground">
                    수동으로 등록/수정한(is_custom) 품목 중 퐁당닷컴 최신가가 바뀐 품목만
                    모았습니다. 선택하지 않으면 기존 내 가격이 그대로 유지됩니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={selectedPendingItems.length === 0}
                      onClick={() => applyPrices(selectedPendingItems)}
                    >
                      선택 항목 퐁당가로 일괄 업데이트 ({selectedPendingItems.length})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => keepItems(pendingItems)}
                    >
                      전체 내 가격 유지하기
                    </Button>
                  </div>
                </div>

                <ul className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto">
                  {pendingItems.map((item) => {
                    const isUp = item.newPrice > item.oldPrice;
                    const diff = Math.abs(item.newPrice - item.oldPrice);
                    const isApplying = applyingIds.has(item.id);
                    return (
                      <li
                        key={item.id}
                        className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1 size-4"
                            checked={selectedIds.has(item.id)}
                            onChange={() => toggleSelected(item.id)}
                            aria-label={`${item.name} 선택`}
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium">{item.name}</span>
                            <span className="text-xs text-muted-foreground">{item.category}</span>
                            <div className="mt-1 flex items-center gap-1.5 text-sm">
                              <span className="text-muted-foreground line-through">
                                {formatWon(item.oldPrice)}
                              </span>
                              <ArrowRight className="size-3.5 text-muted-foreground" />
                              <span className="font-semibold">{formatWon(item.newPrice)}</span>
                              <span
                                className={cn(
                                  "ml-1 flex items-center gap-0.5 text-xs font-medium",
                                  isUp ? "text-red-600" : "text-blue-600"
                                )}
                              >
                                {isUp ? (
                                  <TrendingUp className="size-3.5" />
                                ) : (
                                  <TrendingDown className="size-3.5" />
                                )}
                                {isUp ? "인상" : "인하"} {formatWon(diff)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2 self-end sm:self-center">
                          <Button
                            type="button"
                            size="sm"
                            disabled={isApplying}
                            onClick={() => applyPrices([item])}
                          >
                            퐁당가 반영
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={isApplying}
                            onClick={() => keepItems([item])}
                          >
                            내 가격 유지
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
