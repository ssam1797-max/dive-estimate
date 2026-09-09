"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 가벼운 모달(Dialog) 컴포넌트.
 * (Radix Dialog 를 쓰지 않고 최소 의존성으로 구현한 버전입니다. 배경 클릭/ESC 로
 *  닫히고, 열려 있는 동안 배경 스크롤을 막습니다.)
 */
interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  /** 모달 바깥 래퍼의 최대 너비 클래스. 기본값은 max-w-md (기존 동작 유지). */
  widthClassName?: string;
}

function Dialog({
  open,
  onOpenChange,
  children,
  widthClassName = "max-w-md",
}: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // 서버 렌더링 결과와 클라이언트 첫 렌더링을 일치시키기 위한 표준적인
    // "마운트 이후에만 포털을 그린다" 패턴입니다. (document 가 없는 서버에서는
    // 포털을 그릴 수 없어 hydration mismatch 를 피하려면 이 방식이 필요합니다.)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50"
        aria-hidden="true"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn("relative z-10 w-full", widthClassName)}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

function DialogContent({
  className,
  children,
  onClose,
}: {
  className?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className={cn(
        "relative flex max-h-[85vh] flex-col gap-4 overflow-y-auto rounded-lg border bg-background p-6 shadow-lg",
        className
      )}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-sm text-muted-foreground transition-colors hover:text-foreground"
        aria-label="닫기"
      >
        <X className="size-4" />
      </button>
      {children}
    </div>
  );
}

function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1 pr-6">{children}</div>;
}

function DialogTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold">{children}</h2>;
}

function DialogDescription({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-end gap-2 pt-2">{children}</div>
  );
}

export {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
};
