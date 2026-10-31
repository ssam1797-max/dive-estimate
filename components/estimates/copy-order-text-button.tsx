"use client";

import * as React from "react";
import { Check, ClipboardList, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";
import { copyTextToClipboard } from "@/lib/clipboard";
import { buildSupplierOrderText } from "@/lib/estimates/orderText";
import type { SavedEstimateDetail } from "@/lib/estimates/types";
import { cn } from "@/lib/utils";

async function fetchEstimateDetail(estimateId: string): Promise<SavedEstimateDetail> {
  const response = await fetch(`/api/estimates/${estimateId}`);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((body as { error?: string }).error ?? "견적서를 불러오지 못했습니다.");
  }
  return (body as { estimate: SavedEstimateDetail }).estimate;
}

interface CopyOrderTextButtonProps {
  estimateId: string;
  /** 이미 불러온 상세가 있으면 넘긴다(상세 모달). 없으면 클릭 시 서버에서 조회한다(목록 행). */
  detail?: SavedEstimateDetail | null;
  /** "icon": 목록 행의 작은 아이콘 버튼, "button": 글자가 있는 일반 버튼. */
  variant?: "icon" | "button";
  className?: string;
}

/**
 * [발주 복사] — 견적서의 품목/수량/옵션 + 받는사람 이름/연락처/주소를
 * 카카오톡·문자에 바로 붙여넣을 수 있는 텍스트로 클립보드에 복사한다.
 */
export function CopyOrderTextButton({
  estimateId,
  detail,
  variant = "button",
  className,
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
    if (status === "copying") return;
    setStatus("copying");

    let missingFields: string[] = [];
    const textPromise = (detail ? Promise.resolve(detail) : fetchEstimateDetail(estimateId)).then(
      (loaded) => {
        if (loaded.items.length === 0) {
          throw new Error("견적서에 담긴 품목이 없습니다.");
        }
        const result = buildSupplierOrderText(loaded);
        missingFields = result.missingFields;
        return result.text;
      }
    );

    try {
      await copyTextToClipboard(detail ? await textPromise : textPromise);
      setStatus("copied");
      setToast(
        missingFields.length > 0
          ? {
              tone: "info",
              message: `발주 내용을 복사했습니다. 받는사람 ${missingFields.join("·")}이(가) 비어 있으니 붙여넣은 뒤 채워주세요.`,
            }
          : { tone: "success", message: "발주 내용을 복사했습니다. 카카오톡·문자에 붙여넣으세요." }
      );
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

  const icon =
    status === "copying" ? (
      <Loader2 className={cn(variant === "icon" ? "size-3.5" : "size-4", "animate-spin")} />
    ) : status === "copied" ? (
      <Check className={cn(variant === "icon" ? "size-3.5" : "size-4", "text-emerald-600")} />
    ) : (
      <ClipboardList className={variant === "icon" ? "size-3.5" : "size-4"} />
    );

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClick}
          disabled={status === "copying"}
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
          disabled={status === "copying"}
          className={className}
        >
          {icon}
          {status === "copied" ? "복사됨" : "발주 복사"}
        </Button>
      )}
      <InlineToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
