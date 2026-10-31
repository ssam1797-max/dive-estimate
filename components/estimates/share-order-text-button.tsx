"use client";

import * as React from "react";
import { MessageSquareText, Share2 } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";
import { copyTextToClipboard } from "@/lib/clipboard";

const noopSubscribe = () => () => {};

/** 이 브라우저가 텍스트 공유창(navigator.share)을 지원하는지 — 휴대폰, Safari 등. */
function useCanShareText(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => typeof navigator !== "undefined" && typeof navigator.share === "function",
    () => false
  );
}

/**
 * 문자 앱 링크. iOS 는 "sms:&body=", 안드로이드는 "sms:?body=" 를 쓰는데,
 * "sms:?&body=" 형식은 두 플랫폼(및 Mac 메시지 앱) 모두에서 본문이 채워진다.
 */
function buildSmsHref(text: string): string {
  return `sms:?&body=${encodeURIComponent(text)}`;
}

interface ShareOrderTextButtonProps {
  /** 공유할 발주 문구(이미 만들어진 텍스트). */
  text: string;
  className?: string;
  /** 공유/문자 앱으로 넘긴 뒤 호출된다(공유창을 취소하면 호출되지 않음). */
  onShared?: () => void;
}

/**
 * [공유] + [문자] — 관리자 여부와 관계없이 누구나 쓸 수 있다.
 *
 * - [공유]: 휴대폰 기본 공유창을 띄워 카카오톡·문자 등으로 바로 보낸다.
 *   공유창을 지원하지 않는 브라우저(대부분의 PC 크롬 등)에서는 숨기지 않고
 *   클립보드 복사로 대신한 뒤 안내한다.
 * - [문자]: 문자 앱을 발주 문구가 채워진 상태로 바로 연다(sms: 링크).
 *
 * 공유창은 "사용자가 누른 그 순간"에만 열 수 있어서, 서버 조회 없이 텍스트가
 * 이미 준비된 곳(견적서 상세 창)에서 쓴다.
 */
export function ShareOrderTextButton({ text, className, onShared }: ShareOrderTextButtonProps) {
  const canShare = useCanShareText();
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const dismissToast = React.useCallback(() => setToast(null), []);

  const handleShareClick = async (event: React.MouseEvent) => {
    event.stopPropagation();

    if (!canShare) {
      try {
        await copyTextToClipboard(text);
        setToast({
          tone: "info",
          message:
            "이 브라우저는 공유창을 지원하지 않아 발주 내용을 복사했습니다. 카카오톡·문자에 붙여넣으세요.",
        });
        onShared?.();
      } catch {
        setToast({ tone: "error", message: "클립보드 복사에 실패했습니다. 다시 시도해주세요." });
      }
      return;
    }

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
      <a
        href={buildSmsHref(text)}
        onClick={(event) => {
          event.stopPropagation();
          onShared?.();
        }}
        className={buttonVariants({ variant: "outline", className })}
        title="문자 앱을 발주 내용이 채워진 상태로 엽니다"
      >
        <MessageSquareText className="size-4" />
        문자
      </a>
      <Button type="button" variant="outline" onClick={handleShareClick} className={className}>
        <Share2 className="size-4" />
        공유
      </Button>
      <InlineToast toast={toast} onDismiss={dismissToast} />
    </>
  );
}
