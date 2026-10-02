"use client";

import * as React from "react";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";

/**
 * 카카오톡 공유는 카카오 개발자센터 승인 전까지 "서비스 예정" 안내만
 * 띄운다 — order-complete-dialog.tsx 의 KAKAO_SHARE_ENABLED 와 같은 스위치.
 * 승인 완료되면 이 화면에도 실제 공유를 연결한다.
 */
const KAKAO_PENDING_MESSAGE =
  "카카오톡 공유 기능은 카카오 승인 후 오픈 예정입니다. '링크 복사' 기능을 이용해주세요.";

interface EstimateSaveCompleteDialogProps {
  open: boolean;
  estimateNumber: string;
  /** 공유할 읽기 전용 견적서 링크(/estimates/{id}/print). */
  printUrl: string;
  /** 확인(닫기) 버튼을 누르면 호출 — 폼 초기화는 호출하는 쪽이 책임진다. */
  onConfirm: () => void;
}

/**
 * [견적서 만들기]로 신규 저장 완료 후 뜨는 모달. 기본 액션은 "링크 복사"
 * (클립보드) 로, 저장된 견적서를 읽기 전용으로 볼 수 있는 인쇄 페이지
 * 주소를 복사한다 — 비밀번호 없이도 누구나 열람할 수 있는 링크라 받는
 * 분에게 그대로 전달하면 된다.
 */
export function EstimateSaveCompleteDialog({
  open,
  estimateNumber,
  printUrl,
  onConfirm,
}: EstimateSaveCompleteDialogProps) {
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: "success", message: "클립보드에 복사되었습니다." });
    } catch {
      setToast({ tone: "error", message: "클립보드 복사에 실패했습니다. 다시 시도해주세요." });
    }
  };

  const handleKakaoClick = () => {
    setToast({ tone: "info", message: KAKAO_PENDING_MESSAGE });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onConfirm()} widthClassName="max-w-md">
      <DialogContent onClose={onConfirm}>
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              견적서가 저장되었습니다.
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">견적서 번호</span>
          <span className="text-lg font-semibold">{estimateNumber}</span>
        </div>

        {/* 기본 액션: 링크 복사(클립보드) */}
        <Button type="button" className="w-full" onClick={() => copyText(printUrl)}>
          <Copy className="size-4" />
          링크 복사
        </Button>

        <Button
          type="button"
          variant="outline"
          className="text-muted-foreground"
          onClick={handleKakaoClick}
        >
          <MessageCircle className="size-4" />
          카카오톡 공유
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            서비스 예정
          </span>
        </Button>

        <p className="text-xs text-muted-foreground">
          이 링크를 열면 비밀번호 없이 견적서 내용을 읽기 전용으로 볼 수 있습니다.
        </p>

        <DialogFooter>
          <Button type="button" onClick={onConfirm} className="w-full sm:w-auto">
            확인 (새 견적서 계속 작성)
          </Button>
        </DialogFooter>
      </DialogContent>

      <InlineToast toast={toast} onDismiss={() => setToast(null)} durationMs={2500} />
    </Dialog>
  );
}
