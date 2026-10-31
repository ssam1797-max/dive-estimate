"use client";

import * as React from "react";
import Link from "next/link";
import { Copy, Loader2, PackageOpen, Pencil, Printer, Search, Trash2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PriceTierSelect } from "@/components/estimates/price-tier-select";
import { CopyOrderTextButton } from "@/components/estimates/copy-order-text-button";
import { ShareOrderTextButton } from "@/components/estimates/share-order-text-button";
import { buildSupplierOrderText } from "@/lib/estimates/orderText";
import { matchesKoreanSearch } from "@/lib/hangul";
import type {
  EstimateStatus,
  SavedEstimateDetail,
  SavedEstimateSummary,
} from "@/lib/estimates/types";
import { getAllowedPriceTiers, tierPriceOfSnapshot, type PriceTier } from "@/lib/estimates/pricing";

interface EstimateArchiveTableProps {
  initialEstimates: SavedEstimateSummary[];
  /** 관리자 모드 여부 — 원가("COST") 등급은 관리자 모드에서만 선택할 수 있다. */
  isAdmin: boolean;
}

const STATUS_LABELS: Record<EstimateStatus, string> = {
  draft: "작성중",
  sent: "발송됨",
  approved: "승인됨",
  ordered: "발주완료",
  cancelled: "취소됨",
};

const STATUS_TEXT_CLASS: Record<EstimateStatus, string> = {
  draft: "text-muted-foreground",
  sent: "text-blue-600 dark:text-blue-400",
  approved: "text-emerald-600 dark:text-emerald-400",
  ordered: "text-violet-600 dark:text-violet-400",
  cancelled: "text-destructive",
};

function StatusSelect({
  value,
  onChange,
  disabled,
  className,
}: {
  value: EstimateStatus;
  onChange: (status: EstimateStatus) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Select
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as EstimateStatus)}
      onClick={(event) => event.stopPropagation()}
      className={`h-7 text-xs font-medium ${STATUS_TEXT_CLASS[value]} ${className ?? ""}`}
      aria-label="견적서 상태"
    >
      {(Object.keys(STATUS_LABELS) as EstimateStatus[]).map((status) => (
        <option key={status} value={status}>
          {STATUS_LABELS[status]}
        </option>
      ))}
    </Select>
  );
}

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

async function deleteEstimate(id: string, currentPassword?: string): Promise<void> {
  const response = await fetch(`/api/estimates/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ currentPassword }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "삭제에 실패했습니다.");
  }
}

async function updateEstimateStatus(id: string, status: EstimateStatus): Promise<void> {
  const response = await fetch(`/api/estimates/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? "상태 변경에 실패했습니다.");
  }
}


function EstimateDetailDialog({
  estimateId,
  tier,
  isAdmin,
  onOpenChange,
  onDeleted,
  onStatusChanged,
}: {
  estimateId: string;
  tier: PriceTier;
  isAdmin: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: (id: string) => void;
  onStatusChanged: (id: string, status: EstimateStatus) => void;
}) {
  const [detail, setDetail] = React.useState<SavedEstimateDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deletePassword, setDeletePassword] = React.useState("");
  const [isChangingStatus, setIsChangingStatus] = React.useState(false);
  const [markOrderedOpen, setMarkOrderedOpen] = React.useState(false);
  const orderText = React.useMemo(
    () => (detail ? buildSupplierOrderText(detail).text : ""),
    [detail]
  );

  /** 발주 복사/공유 후, 아직 발주완료가 아니면 상태를 바꿀지 묻는다. */
  const askMarkOrdered = () => {
    if (detail && detail.status !== "ordered") setMarkOrderedOpen(true);
  };

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
    await deleteEstimate(estimateId, deletePassword);
    onDeleted(estimateId);
    onOpenChange(false);
  };

  const handleStatusChange = async (status: EstimateStatus) => {
    if (!detail) return;
    setIsChangingStatus(true);
    setError(null);
    try {
      await updateEstimateStatus(estimateId, status);
      setDetail({ ...detail, status });
      onStatusChanged(estimateId, status);
    } catch (statusError) {
      setError(
        statusError instanceof Error ? statusError.message : "상태 변경에 실패했습니다."
      );
    } finally {
      setIsChangingStatus(false);
    }
  };

  // 비밀번호가 없는(비밀번호 기능 도입 이전) 견적서, 그리고 [장바구니
  // 구매요청]으로 접수돼 고객이 모르는 무작위 비밀번호가 걸린 견적서는
  // 관리자 모드에서만 수정/삭제할 수 있다.
  const canModify = isAdmin || Boolean(detail?.hasEditPassword && !detail.isPurchaseRequest);
  const lockedReason = detail?.isPurchaseRequest
    ? "장바구니 구매요청으로 접수된 주문은 관리자 모드에서만 수정/삭제할 수 있습니다."
    : "비밀번호가 없는 견적서는 관리자 모드에서만 수정/삭제할 수 있습니다.";

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
              <div className="flex items-center justify-between gap-2 pr-6">
                <DialogTitle>견적서 {detail.estimateNumber}</DialogTitle>
                <StatusSelect
                  value={detail.status}
                  disabled={isChangingStatus}
                  onChange={handleStatusChange}
                  className="w-24"
                />
              </div>
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
                    <th className="py-2 pr-2 font-medium">장비명</th>
                    <th className="py-2 pr-2 font-medium">색상 / 사이즈</th>
                    <th className="py-2 pr-2 font-medium">수량</th>
                    <th className="py-2 pr-2 font-medium">단가</th>
                    <th className="py-2 pr-2 font-medium">소계</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item, index) => {
                    const unitPrice = tierPriceOfSnapshot(item, tier);
                    return (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 pr-2 align-top font-medium" title={item.name}>
                          {item.name}
                        </td>
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
                    <td colSpan={4} className="pt-3 text-right font-medium">
                      합계
                    </td>
                    <td className="pt-3 text-lg font-semibold">
                      {formatCurrency(detail.totalsByTier[tier])}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-muted-foreground">
                  발주 문구 미리보기 (카카오톡·문자용)
                </p>
                <div className="flex items-center gap-1.5">
                  <ShareOrderTextButton text={orderText} onShared={askMarkOrdered} />
                  <CopyOrderTextButton
                    estimateIds={[detail.id]}
                    detail={detail}
                    onCopied={askMarkOrdered}
                  />
                </div>
              </div>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-keep rounded-md border bg-muted/50 px-3 py-2 font-sans text-sm leading-relaxed">
                {orderText}
              </pre>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={!canModify}
                onClick={() => setConfirmDeleteOpen(true)}
                className="mr-auto text-muted-foreground hover:text-destructive"
                title={canModify ? undefined : lockedReason}
              >
                <Trash2 className="size-4" />
                삭제
              </Button>
              <Link
                href={`/estimates/new?duplicateFrom=${detail.id}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Copy className="size-4" />
                복제
              </Link>
              {canModify ? (
                <Link
                  href={`/estimates/${detail.id}/edit`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  <Pencil className="size-4" />
                  이어서 수정
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title={lockedReason}
                  className={buttonVariants({
                    variant: "outline",
                    className: "cursor-not-allowed opacity-50",
                  })}
                >
                  <Pencil className="size-4" />
                  이어서 수정
                </span>
              )}
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
      <ConfirmDialog
        open={markOrderedOpen}
        onOpenChange={setMarkOrderedOpen}
        title="발주완료로 표시할까요?"
        description="상태를 '발주완료'로 바꾸면 보관함에서 이미 발주한 견적서를 쉽게 구분할 수 있습니다."
        confirmLabel="발주완료로 변경"
        cancelLabel="나중에"
        variant="default"
        onConfirm={() => handleStatusChange("ordered")}
      />
      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) setDeletePassword("");
        }}
        title="이 견적서를 삭제할까요?"
        description="삭제하면 되돌릴 수 없습니다."
        onConfirm={handleDelete}
      >
        {!isAdmin && detail?.hasEditPassword && !detail?.isPurchaseRequest && (
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value.replace(/\D/g, ""))}
            placeholder="견적서 비밀번호"
            aria-label="견적서 비밀번호"
          />
        )}
      </ConfirmDialog>
    </Dialog>
  );
}

/** [견적서 저장] 으로 저장한 견적서 목록. 행을 누르면 담겼던 장비 내역을 볼 수 있습니다. */
export function EstimateArchiveTable({ initialEstimates, isAdmin }: EstimateArchiveTableProps) {
  const allowedPriceTiers = React.useMemo(() => getAllowedPriceTiers(isAdmin), [isAdmin]);
  const [estimates, setEstimates] = React.useState(initialEstimates);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [rowDeleteTarget, setRowDeleteTarget] = React.useState<string | null>(null);
  const [rowDeletePassword, setRowDeletePassword] = React.useState("");
  const [rowError, setRowError] = React.useState<string | null>(null);
  const [tier, setTier] = React.useState<PriceTier>("RETAIL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<EstimateStatus | "all">("all");
  const rowDeleteTargetEstimate = estimates.find((e) => e.id === rowDeleteTarget);
  // 묶음 발주용 체크박스 선택. 삭제된 견적서 id 가 남아 있을 수 있어 아래에서 걸러 쓴다.
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(() => new Set());
  // 발주 복사 후 "발주완료로 바꿀까요?" 확인 대상(1건 또는 묶음).
  const [markOrderedTargets, setMarkOrderedTargets] = React.useState<string[]>([]);

  // 공급받는자명 또는 견적서 번호로 검색하고, 발행일 범위/상태로 좁힌다.
  // 목록을 전부 미리 불러온 상태(initialEstimates)에서 클라이언트 쪽에서만
  // 걸러내면 되므로 서버 요청 없이 즉시 반영된다.
  const filteredEstimates = React.useMemo(() => {
    const query = searchQuery.trim();
    return estimates.filter((estimate) => {
      if (
        query &&
        !matchesKoreanSearch(estimate.receiverName, query) &&
        !matchesKoreanSearch(estimate.estimateNumber, query)
      ) {
        return false;
      }
      if (dateFrom && estimate.date < dateFrom) return false;
      if (dateTo && estimate.date > dateTo) return false;
      if (statusFilter !== "all" && estimate.status !== statusFilter) return false;
      return true;
    });
  }, [estimates, searchQuery, dateFrom, dateTo, statusFilter]);

  const checkedEstimates = React.useMemo(
    () => estimates.filter((e) => checkedIds.has(e.id)),
    [estimates, checkedIds]
  );
  const checkedEstimateIds = React.useMemo(
    () => checkedEstimates.map((e) => e.id),
    [checkedEstimates]
  );
  const allFilteredChecked =
    filteredEstimates.length > 0 && filteredEstimates.every((e) => checkedIds.has(e.id));

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) filteredEstimates.forEach((e) => next.delete(e.id));
      else filteredEstimates.forEach((e) => next.add(e.id));
      return next;
    });
  };

  /** 발주 복사가 끝난 견적서 중 아직 발주완료가 아닌 것만 골라 확인창을 띄운다. */
  const askMarkOrdered = (ids: string[]) => {
    const targets = ids.filter((id) => estimates.find((e) => e.id === id)?.status !== "ordered");
    if (targets.length > 0) setMarkOrderedTargets(targets);
  };

  const handleMarkOrdered = async () => {
    const failed: string[] = [];
    for (const id of markOrderedTargets) {
      try {
        await updateEstimateStatus(id, "ordered");
        handleStatusChange(id, "ordered");
      } catch {
        failed.push(estimates.find((e) => e.id === id)?.estimateNumber ?? id);
      }
    }
    if (failed.length > 0) {
      throw new Error(`일부 견적서의 상태를 바꾸지 못했습니다: ${failed.join(", ")}`);
    }
    setCheckedIds(new Set());
  };

  const handleStatusChange = (id: string, status: EstimateStatus) => {
    setEstimates((prev) => prev.map((e) => (e.id === id ? { ...e, status } : e)));
  };

  const handleRowStatusChange = async (id: string, status: EstimateStatus) => {
    setRowError(null);
    try {
      await updateEstimateStatus(id, status);
      handleStatusChange(id, status);
    } catch (statusError) {
      setRowError(
        statusError instanceof Error ? statusError.message : "상태 변경에 실패했습니다."
      );
    }
  };

  const handleRowDelete = async (id: string, password?: string) => {
    setRowError(null);
    try {
      await deleteEstimate(id, password);
      setEstimates((prev) => prev.filter((e) => e.id !== id));
    } catch (deleteError) {
      setRowError(
        deleteError instanceof Error ? deleteError.message : "삭제에 실패했습니다."
      );
      throw deleteError;
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
      <PriceTierSelect value={tier} onChange={setTier} tiers={allowedPriceTiers} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="공급받는자명 또는 견적서 번호로 검색"
            className="pl-9"
            aria-label="견적서 검색"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="시작일"
            className="w-[8.5rem] sm:w-[9.5rem]"
          />
          <span className="text-sm text-muted-foreground">~</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="종료일"
            className="w-[8.5rem] sm:w-[9.5rem]"
          />
          <Select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as EstimateStatus | "all")
            }
            aria-label="상태 필터"
            className="w-28"
          >
            <option value="all">전체 상태</option>
            {(Object.keys(STATUS_LABELS) as EstimateStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {rowError && <p className="text-sm text-destructive">{rowError}</p>}

      {checkedEstimates.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm dark:border-violet-900 dark:bg-violet-950/40">
          <span className="font-medium">{checkedEstimates.length}건 선택</span>
          <span className="text-xs text-muted-foreground">
            같은 받는사람끼리 묶고, 같은 품목·옵션은 수량을 합쳐 복사합니다.
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setCheckedIds(new Set())}
            >
              선택 해제
            </Button>
            <CopyOrderTextButton
              estimateIds={checkedEstimateIds}
              label="묶음 발주 복사"
              onCopied={() => askMarkOrdered(checkedEstimateIds)}
            />
          </div>
        </div>
      )}

      {filteredEstimates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
            <PackageOpen className="size-8" />
            검색 조건과 일치하는 견적서가 없습니다.
          </CardContent>
        </Card>
      ) : (
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="w-10 py-3 pl-4 pr-0">
                  <input
                    type="checkbox"
                    checked={allFilteredChecked}
                    onChange={toggleAllFiltered}
                    aria-label="표시된 견적서 전체 선택"
                    className="size-4 cursor-pointer accent-violet-600"
                  />
                </th>
                <th className="px-4 py-3 font-medium">견적서 번호</th>
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">공급받는자</th>
                <th className="px-4 py-3 font-medium">품목</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 text-right font-medium">합계</th>
                <th className="px-4 py-3 text-right font-medium">작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredEstimates.map((estimate) => {
                const canModifyRow =
                  isAdmin || (estimate.hasEditPassword && !estimate.isPurchaseRequest);
                const lockedRowReason = estimate.isPurchaseRequest
                  ? "장바구니 구매요청으로 접수된 주문은 관리자 모드에서만 수정/삭제할 수 있습니다."
                  : "비밀번호가 없는 견적서는 관리자 모드에서만 수정/삭제할 수 있습니다.";
                return (
                <tr
                  key={estimate.id}
                  onClick={() => setSelectedId(estimate.id)}
                  className={`cursor-pointer border-b last:border-0 hover:bg-accent/60 ${
                    checkedIds.has(estimate.id) ? "bg-violet-50/60 dark:bg-violet-950/30" : ""
                  }`}
                >
                  <td
                    className="w-10 py-3 pl-4 pr-0"
                    onClick={(event) => {
                      // 체크박스 주변 여백을 눌러도 상세 창이 열리지 않고 선택만 바뀌게 한다.
                      event.stopPropagation();
                      if (event.target === event.currentTarget) toggleChecked(estimate.id);
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checkedIds.has(estimate.id)}
                      onChange={() => toggleChecked(estimate.id)}
                      aria-label={`${estimate.estimateNumber} 선택`}
                      className="size-4 cursor-pointer accent-violet-600"
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{estimate.estimateNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{estimate.date}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {estimate.receiverName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {estimate.itemCount}건
                  </td>
                  <td className="px-4 py-3">
                    <StatusSelect
                      value={estimate.status}
                      onChange={(status) => handleRowStatusChange(estimate.id, status)}
                      className="w-24"
                    />
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(estimate.totalsByTier[tier])}
                  </td>
                  <td
                    className="px-4 py-3"
                    // 비활성화된(disabled) 삭제 버튼을 클릭하면, 버튼 자체의
                    // onClick(stopPropagation 포함)은 React가 호출해주지 않는데도
                    // 클릭 이벤트 자체는 그대로 이 셀을 거쳐 <tr> 까지 버블링돼
                    // 행 클릭(상세보기 "불러오는 중..." 열기)이 그대로 실행되던
                    // 버그가 있었다 — 셀 전체에서 한 번에 막는다(개별 버튼이
                    // 비활성화인지와 무관하게 항상 동작).
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <CopyOrderTextButton
                        estimateIds={[estimate.id]}
                        variant="icon"
                        onCopied={() => askMarkOrdered([estimate.id])}
                      />
                      <Link
                        href={`/estimates/new?duplicateFrom=${estimate.id}`}
                        aria-label={`${estimate.estimateNumber} 복제`}
                        onClick={(event) => event.stopPropagation()}
                        className={buttonVariants({
                          variant: "ghost",
                          size: "icon",
                          className: "size-7 text-muted-foreground hover:text-foreground",
                        })}
                      >
                        <Copy className="size-3.5" />
                      </Link>
                      {canModifyRow ? (
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
                      ) : (
                        <span
                          aria-disabled="true"
                          title={lockedRowReason}
                          onClick={(event) => event.stopPropagation()}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "icon",
                            className: "size-7 cursor-not-allowed text-muted-foreground/40",
                          })}
                        >
                          <Pencil className="size-3.5" />
                        </span>
                      )}
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
                        disabled={!canModifyRow}
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRowDeleteTarget(estimate.id);
                        }}
                        aria-label={`${estimate.estimateNumber} 삭제`}
                        title={canModifyRow ? undefined : lockedRowReason}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
      )}

      {selectedId && (
        <EstimateDetailDialog
          estimateId={selectedId}
          tier={tier}
          isAdmin={isAdmin}
          onOpenChange={(open) => {
            if (!open) setSelectedId(null);
          }}
          onDeleted={handleDetailDeleted}
          onStatusChanged={handleStatusChange}
        />
      )}

      <ConfirmDialog
        open={rowDeleteTarget !== null}
        onOpenChange={(open) => {
          setRowDeleteTarget(open ? rowDeleteTarget : null);
          if (!open) setRowDeletePassword("");
        }}
        title="이 견적서를 삭제할까요?"
        description="삭제하면 되돌릴 수 없습니다."
        onConfirm={() => {
          if (rowDeleteTarget) return handleRowDelete(rowDeleteTarget, rowDeletePassword);
        }}
      >
        {!isAdmin && rowDeleteTargetEstimate?.hasEditPassword && !rowDeleteTargetEstimate.isPurchaseRequest && (
          <Input
            type="password"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={rowDeletePassword}
            onChange={(event) => setRowDeletePassword(event.target.value.replace(/\D/g, ""))}
            placeholder="견적서 비밀번호"
            aria-label="견적서 비밀번호"
          />
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={markOrderedTargets.length > 0}
        onOpenChange={(open) => {
          if (!open) setMarkOrderedTargets([]);
        }}
        title={
          markOrderedTargets.length > 1
            ? `${markOrderedTargets.length}건을 발주완료로 표시할까요?`
            : "발주완료로 표시할까요?"
        }
        description="상태를 '발주완료'로 바꾸면 보관함에서 이미 발주한 견적서를 쉽게 구분할 수 있습니다."
        confirmLabel="발주완료로 변경"
        cancelLabel="나중에"
        variant="default"
        onConfirm={handleMarkOrdered}
      />
    </>
  );
}
