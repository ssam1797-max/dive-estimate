"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Pencil, TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";
import { EquipmentEditDialog } from "@/components/equipment/equipment-edit-dialog";
import { EquipmentThumbnail } from "@/components/equipment/equipment-thumbnail";
import { cn } from "@/lib/utils";
import type { PendingReviewEquipmentItem } from "@/lib/equipment/types";

interface PendingReviewManagerProps {
  items: PendingReviewEquipmentItem[];
  initialBrands: string[];
}

function formatWon(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(iso: string): string {
  const parts = dateTimeFormatter.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

/**
 * "확인 필요 품목" 전용 탭. 동기화 세션(SyncResultDialog)과 달리 서버에
 * 영구 저장된(pending_review_price) 품목을 보여주므로, 언제든 들어와서
 * 처리할 수 있다. 각 행의 액션은 전부 router.refresh() 로 마무리해 이
 * 서버 컴포넌트 트리(상단 탭 뱃지 포함)를 최신 상태로 다시 그린다.
 */
export function PendingReviewManager({ items, initialBrands }: PendingReviewManagerProps) {
  const router = useRouter();
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [editTargetId, setEditTargetId] = React.useState<string | null>(null);

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const applyNewPrice = async (item: PendingReviewEquipmentItem) => {
    setBusy(item.id, true);
    try {
      const response = await fetch("/api/equipment/price-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: [{ id: item.id, price: item.newPrice }] }),
      });
      const body = (await response.json()) as { ok: true } | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "가격 반영에 실패했습니다.");
      }
      setToast({ tone: "success", message: `"${item.name}" 가격을 퐁당가로 반영했습니다.` });
      router.refresh();
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "가격 반영 중 오류가 발생했습니다.",
      });
    } finally {
      setBusy(item.id, false);
    }
  };

  const keepCurrentPrice = async (item: PendingReviewEquipmentItem) => {
    setBusy(item.id, true);
    try {
      const response = await fetch("/api/equipment/price-review/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [item.id] }),
      });
      const body = (await response.json()) as { ok: true } | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : "확인 완료 처리에 실패했습니다.");
      }
      setToast({ tone: "success", message: `"${item.name}" 현재 가격을 유지하고 확인 완료했습니다.` });
      router.refresh();
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : "확인 완료 처리 중 오류가 발생했습니다.",
      });
    } finally {
      setBusy(item.id, false);
    }
  };

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          🎉 확인이 필요한 품목이 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const isUp = item.newPrice > item.currentPrice;
          const diff = Math.abs(item.newPrice - item.currentPrice);
          const isBusy = busyIds.has(item.id);
          return (
            <li key={item.id}>
              <Card>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <EquipmentThumbnail src={item.image_url} alt={item.name} />
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="text-xs text-muted-foreground">
                        {item.brand} · {item.category}
                      </p>
                      <p className="truncate text-sm font-semibold" title={item.name}>
                        {item.name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm">
                        <span className="text-muted-foreground line-through">
                          {formatWon(item.currentPrice)}
                        </span>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                        <span className="font-semibold">{formatWon(item.newPrice)}</span>
                        <span
                          className={cn(
                            "ml-1 flex items-center gap-0.5 text-xs font-medium",
                            isUp ? "text-red-600" : "text-blue-600"
                          )}
                        >
                          {isUp ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                          {isUp ? "인상" : "인하"} {formatWon(diff)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        감지 시각: {formatDateTime(item.detectedAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2 self-end sm:self-center">
                    <Button type="button" size="sm" disabled={isBusy} onClick={() => applyNewPrice(item)}>
                      퐁당가 반영
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => keepCurrentPrice(item)}
                    >
                      현재가 유지
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => setEditTargetId(item.id)}
                    >
                      <Pencil className="size-3.5" />
                      수정
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <InlineToast toast={toast} onDismiss={() => setToast(null)} />

      {editTargetId && (
        <EquipmentEditDialog
          equipmentId={editTargetId}
          initialBrands={initialBrands}
          onOpenChange={(open) => {
            if (!open) setEditTargetId(null);
          }}
          onSaved={() => {
            setEditTargetId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
