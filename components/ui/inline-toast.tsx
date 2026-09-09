"use client";

import * as React from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export interface ToastState {
  tone: "success" | "error";
  message: string;
}

const AUTO_DISMISS_MS = 4000;

/**
 * 별도 Toast 라이브러리 없이, 화면 우측 하단에 잠깐 떴다 사라지는
 * 알림 한 건을 보여주는 최소 구현. 여러 건을 큐잉하지는 않는다.
 */
export function InlineToast({
  toast,
  onDismiss,
}: {
  toast: ToastState | null;
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-2 rounded-lg border p-3 text-sm shadow-lg",
        toast.tone === "success"
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
          : "border-destructive/40 bg-destructive/5 text-destructive"
      )}
    >
      {toast.tone === "success" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      ) : (
        <XCircle className="mt-0.5 size-4 shrink-0" />
      )}
      <span className="leading-snug">{toast.message}</span>
    </div>
  );
}
