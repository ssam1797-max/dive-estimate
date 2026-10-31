"use client";

import * as React from "react";
import { Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";

const noopSubscribe = () => () => {};

/** 이 브라우저가 텍스트 공유(navigator.share)를 지원하는지 — 주로 휴대폰. */
function useCanShareText(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  );
}

interface ShareOrderTextButtonProps {
  /** 공유할 발주 문구(이미 만들어진 텍스트). */
  text: string;
  className?: string;
  /** 공유창에서 앱을 골라 보낸 뒤 호출된다(취소하면 호출되지 않음). */
  onShared?: () => void;
}

/**
 * [공유] — 휴대폰 기본 공유창을 띄워 카카오톡·문자 등으로 발주 문구를 바로
 * 보낸다. 공유를 지원하지 않는 브라우저(대부분의 PC)에서는 아예 보이지 않는다.
 *
 * 공유창은 "사용자가 누른 그 순간"에만 열 수 있어서, 서버 조회 없이 텍스트가
 * 이미 준비된 곳(견적서 상세 창)에서만 쓴다.
 */
export function ShareOrderTextButton({ text, className, onShared }: ShareOrderTextButtonProps) {
  const canShare = useCanShareText();
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const dismissToast = React.useCallback(() => setToast(null), []);

  if (!canShare) return null;

  const handleClick = async (event: React.MouseEvent) => {
    event.stopPropagation();
    try {
      await navigator.share({ text });
      onShared?.();
    } catch (error) {
      // 사용자가 공유창을 닫은 경우는 정상 동작이므로 조용히 넘어간다.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setToast({
        tone: "error",
        message: "공유창을 열지 못했습니다. [발주 복사]로 복사해서 붙여넣어 주세요.",
      });
    }
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={handleClick} className={className}>
        <Share2 className="size-4" />
        공유
      </Button>
      <InlineToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
