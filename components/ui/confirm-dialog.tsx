"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button, type ButtonProps } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** 삭제처럼 되돌릴 수 없는 작업이면 destructive(기본값). */
  variant?: ButtonProps["variant"];
  onConfirm: () => Promise<void> | void;
}

/**
 * window.confirm() 대체용 확인 다이얼로그. 네이티브 confirm()은 브라우저
 * 렌더러 자체를 동기적으로 멈추기 때문에(자동화/임베드 환경에서 탭이 그대로
 * 멈춰버리는 사례가 실제로 있었다), 이 앱의 다른 다이얼로그(템플릿 저장 등)와
 * 동일한 방식으로 구현한다.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  variant = "destructive",
  onConfirm,
}: ConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // 열릴 때마다 이전 상태(로딩/에러)를 초기화한다.
  React.useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsSubmitting(false);
    setError(null);
  }, [open]);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : "처리 중 오류가 발생했습니다."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant}
            disabled={isSubmitting}
            onClick={handleConfirm}
          >
            {isSubmitting && <Loader2 className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
