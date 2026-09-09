"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, PackageOpen, Pencil, Printer, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PriceTierSelect } from "@/components/estimates/price-tier-select";
import type {
  SavedEstimateDetail,
  SavedEstimateItemDetail,
  SavedEstimateSummary,
} from "@/lib/estimates/types";
import type { PriceTier } from "@/lib/estimates/pricing";

interface EstimateArchiveTableProps {
  initialEstimates: SavedEstimateSummary[];
}

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

async function deleteEstimate(id: string): Promise<void> {
  const response = await fetch(`/api/estimates/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "삭제에 실패했습니다.");
  }
}

/**
 * 선택된 등급의 단가를 돌려준다. 저장 시점 4개 등급 스냅샷이 있으면 그 값을
 * 쓰고, 이 기능 추가 이전에 저장된 견적서(스냅샷 없음)는 단일 unitPrice 로
 * 폴백한다 — estimate-print-view.tsx 와 동일한 규칙.
 */
function tierPriceOf(item: SavedEstimateItemDetail, tier: PriceTier): number {
  const snapshot: Record<PriceTier, number | null> = {
    RETAIL: item.priceRetail,
    INSTRUCTOR: item.priceInstructor,
    CENTER: item.priceCenter,
    COST: item.priceCost,
  };
  return snapshot[tier] ?? item.unitPrice;
}

function EstimateDetailDialog({
  estimateId,
  tier,
  onOpenChange,
  onDeleted,
}: {
  estimateId: string;
  tier: PriceTier;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
}) {
  const [detail, setDetail] = React.useState<SavedEstimateDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`/api/estimates/${estimateId}`);
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body?.error ?? "견적서를 불러오지 못했습니다.");
        }
        if (!cancelled) setDetail(body.estimate as SavedEstimateDetail);
      } catch (fetchError) {
        if (!cancelled) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : "견적서를 불러오지 못했습니다."
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [estimateId]);

  const handleDelete = async () => {
    if (!window.confirm("이 견적서를 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteEstimate(estimateId);
      onDeleted(estimateId);
      onOpenChange(false);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "삭제에 실패했습니다."
      );
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange} widthClassName="max-w-2xl">
      <DialogContent onClose={() => onOpenChange(false)}>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !detail ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            불러오는 중...
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>견적서 {detail.estimateNumber}</DialogTitle>
              <DialogDescription>
                {detail.date} · 공급자 {detail.providerName} · 공급받는자{" "}
                {detail.receiverName}
              </DialogDescription>
            </DialogHeader>

            {detail.remarks && (
              <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                비고: {detail.remarks}
              </p>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-2 font-medium">브랜드 / 카테고리</th>
                    <th className="py-2 pr-2 font-medium">장비명</th>
                    <th className="py-2 pr-2 font-medium">색상 / 사이즈</th>
                    <th className="py-2 pr-2 font-medium">수량</th>
                    <th className="py-2 pr-2 font-medium">단가</th>
                    <th className="py-2 pr-2 font-medium">소계</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item, index) => {
                    const unitPrice = tierPriceOf(item, tier);
                    return (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 pr-2 align-top text-muted-foreground">
                          {item.brand}
                          <br />
                          {item.category}
                        </td>
                        <td className="py-2 pr-2 align-top font-medium">{item.name}</td>
                        <td className="py-2 pr-2 align-top text-muted-foreground">
                          {item.color || "-"} / {item.size || "-"}
                        </td>
                        <td className="py-2 pr-2 align-top">{item.quantity}</td>
                        <td className="py-2 pr-2 align-top">{formatCurrency(unitPrice)}</td>
                        <td className="py-2 pr-2 align-top font-medium">
                          {formatCurrency(unitPrice * item.quantity)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} className="pt-3 text-right font-medium">
                      합계
                    </td>
                    <td className="pt-3 text-lg font-semibold">
                      {formatCurrency(detail.totalsByTier[tier])}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={isDeleting}
                onClick={handleDelete}
                className="mr-auto text-muted-foreground hover:text-destructive"
              >
                {isDeleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                삭제
              </Button>
              <Link
                href={`/estimates/${detail.id}/edit`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Pencil className="size-4" />
                이어서 수정
              </Link>
              <Link
                href={`/estimates/${detail.id}/print`}
                target="_blank"
                className={buttonVariants({ variant: "outline" })}
              >
                <Printer className="size-4" />
                인쇄
              </Link>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** [견적서 저장] 으로 저장한 견적서 목록. 행을 누르면 담겼던 장비 내역을 볼 수 있습니다. */
export function EstimateArchiveTable({ initialEstimates }: EstimateArchiveTableProps) {
  const [estimates, setEstimates] = React.useState(initialEstimates);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [tier, setTier] = React.useState<PriceTier>("RETAIL");

  const handleRowDelete = async (id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    if (!window.confirm("이 견적서를 삭제할까요? 삭제하면 되돌릴 수 없습니다.")) {
      return;
    }
    setDeletingId(id);
    setRowError(null);
    try {
      await deleteEstimate(id);
      setEstimates((prev) => prev.filter((e) => e.id !== id));
    } catch (deleteError) {
      setRowError(
        deleteError instanceof Error ? deleteError.message : "삭제에 실패했습니다."
      );
    } finally {
      setDeletingId(null);
    }
  };

  const handleDetailDeleted = (id: string) => {
    setEstimates((prev) => prev.filter((e) => e.id !== id));
  };

  if (estimates.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <PackageOpen className="size-8" />
          아직 저장된 견적서가 없습니다. [견적서 작성] 화면에서 견적서를
          저장하면 이곳에 표시됩니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <PriceTierSelect value={tier} onChange={setTier} />

      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">견적서 번호</th>
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">공급받는자</th>
                <th className="px-4 py-3 font-medium">품목</th>
                <th className="px-4 py-3 text-right font-medium">합계</th>
                <th className="px-4 py-3 text-right font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {estimates.map((estimate) => (
                <tr
                  key={estimate.id}
                  onClick={() => setSelectedId(estimate.id)}
                  className="cursor-pointer border-b last:border-0 hover:bg-accent/60"
                >
                  <td className="px-4 py-3 font-medium">{estimate.estimateNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{estimate.date}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {estimate.receiverName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {estimate.itemCount}건
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(estimate.totalsByTier[tier])}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/estimates/${estimate.id}/edit`}
                        aria-label={`${estimate.estimateNumber} 이어서 수정`}
                        onClick={(event) => event.stopPropagation()}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon",
                          className: "size-7 text-muted-foreground hover:text-foreground",
                        })}
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                      <Link
                        href={`/estimates/${estimate.id}/print`}
                        target="_blank"
                        aria-label={`${estimate.estimateNumber} 인쇄`}
                        onClick={(event) => event.stopPropagation()}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon",
                          className: "size-7 text-muted-foreground hover:text-foreground",
                        })}
                      >
                        <Printer className="size-3.5" />
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        disabled={deletingId === estimate.id}
                        onClick={(event) => handleRowDelete(estimate.id, event)}
                        aria-label={`${estimate.estimateNumber} 삭제`}
                      >
                        {deletingId === estimate.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {selectedId && (
        <EstimateDetailDialog
          estimateId={selectedId}
          tier={tier}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          onDeleted={handleDetailDeleted}
        />
      )}
    </>
  );
}
