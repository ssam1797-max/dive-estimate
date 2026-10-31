"use client";

import * as React from "react";
import { Check, ClipboardList, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import {
  buildBatchOrderText,
  buildSupplierOrderText,
  type SupplierOrderText,
} from "@/lib/estimates/orderText";
import type { SavedEstimateDetail } from "@/lib/estimates/types";
import { cn } from "@/lib/utils";

export async function fetchEstimateDetail(estimateId: string): Promise<SavedEstimateDetail> {
  const response = await fetch(`/api/estimates/${estimateId}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? "견적서를 불러오지 못했습니다.");
  }
  return (body as { estimate: SavedEstimateDetail }).estimate;
}

/** 견적서 1건이면 단건 형식, 여러 건이면 받는사람별로 묶어 수량을 합친 형식. */
export function buildOrderTextFromDetails(
  details: SavedEstimateDetail[]
): SupplierOrderText & { receiverGroupCount: number } {
  const withItems = details.filter((detail) => detail.items.length > 0);
  if (withItems.length === 0) {
    throw new Error("선택한 견적서에 담긴 품목이 없습니다.");
  }
  if (withItems.length === 1) {
    return { ...buildSupplierOrderText(withItems[0]), receiverGroupCount: 1 };
  }
  return buildBatchOrderText(withItems);
}

interface CopyOrderTextButtonProps {
  /** 복사할 견적서 id 목록. 2건 이상이면 묶음 발주 형식으로 복사된다. */
  estimateIds: string[];
  /** 이미 불러온 상세가 있으면 넘긴다(상세 모달, 단건). 없으면 클릭 시 서버에서 조회한다. */
  detail?: SavedEstimateDetail | null;
  /** "icon": 목록 행의 작은 아이콘 버튼, "button": 글자가 있는 일반 버튼. */
  variant?: "icon" | "button";
  /** 버튼 글자(variant="button" 일 때). 기본값 "발주 복사". */
  label?: string;
  disabled?: boolean;
  className?: string;
  /** 복사에 성공한 뒤 호출된다 — "발주완료로 바꿀까요?" 안내 등에 사용. */
  onCopied?: () => void;
}

/**
 * [발주 복사] — 견적서의 품목/수량/옵션 + 받는사람 이름/연락처/주소를
 * 카카오톡·문자에 바로 붙여넣을 수 있는 텍스트로 클립보드에 복사한다.
 */
export function CopyOrderTextButton({
  estimateIds,
  detail,
  variant = "button",
  label = "발주 복사",
  disabled,
  className,
  onCopied,
}: CopyOrderTextButtonProps) {
  const [status, setStatus] = React.useState<"idle" | "copying" | "copied">("idle");
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const dismissToast = React.useCallback(() => setToast(null), []);

  React.useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (status === "copying" || estimateIds.length === 0) return;
    setStatus("copying");

    let result: (SupplierOrderText & { receiverGroupCount: number }) | null = null;
    const textPromise = (
      detail ? Promise.resolve([detail]) : Promise.all(estimateIds.map(fetchEstimateDetail))
    ).then((details) => {
      result = buildOrderTextFromDetails(details);
      return result.text;
    });

    try {
      // 상세가 이미 있으면 동기적으로 텍스트를 만들 수 있으므로 문자열을,
      // 서버 조회가 필요하면 Promise 를 그대로 넘긴다(모바일 Safari 대응).
      await copyTextToClipboard(detail ? await textPromise : textPromise);
      setStatus("copied");

      const copied = result as (SupplierOrderText & { receiverGroupCount: number }) | null;
      const notes: string[] = [];
      if (copied && copied.receiverGroupCount > 1) {
        notes.push(`배송지가 ${copied.receiverGroupCount}곳이라 구분선으로 나눴습니다.`);
      }
      if (copied && copied.missingFields.length > 0) {
        notes.push(`받는사람 ${copied.missingFields.join("·")}이(가) 비어 있으니 채워주세요.`);
      }
      setToast(
        notes.length > 0
          ? { tone: "info", message: `발주 내용을 복사했습니다. ${notes.join(" ")}` }
          : { tone: "success", message: "발주 내용을 복사했습니다. 카카오톡·문자에 붙여넣으세요." }
      );
      onCopied?.();
    } catch (error) {
      setStatus("idle");
      setToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? `복사 실패: ${error.message}`
            : "클립보드 복사에 실패했습니다. 다시 시도해주세요.",
      });
    }
  };

  const iconSize = variant === "icon" ? "size-3.5" : "size-4";
  const icon =
    status === "copying" ? (
      <Loader2 className={cn(iconSize, "animate-spin")} />
    ) : status === "copied" ? (
      <Check className={cn(iconSize, "text-emerald-600")} />
    ) : (
      <ClipboardList className={iconSize} />
    );

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={disabled || status === "copying"}
          aria-label="발주 내용 복사"
          title="발주 내용 복사 (품목/수량/옵션 + 받는사람)"
          className={cn("size-7 text-muted-foreground hover:text-foreground", className)}
        >
          {icon}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleClick}
          disabled={disabled || status === "copying"}
          className={className}
        >
          {icon}
          {status === "copied" ? "복사됨" : label}
        </Button>
      )}
      <InlineToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
