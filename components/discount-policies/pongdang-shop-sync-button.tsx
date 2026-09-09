"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";

interface BrandShopRate {
  brand: string;
  ratePercent: number;
  sampleCount: number;
}

interface SyncResponse {
  ok: boolean;
  brandRates: BrandShopRate[];
  updatedBrands: string[];
  warnings: string[];
}

/**
 * 퐁당닷컴 상품 목록에 공개적으로 표시되는 할인율 배지(예: "30%↓")를 그대로
 * 읽어 브랜드별 평균을 내고, discount_policies 센터가 탭에 반영하는 버튼.
 * 로그인이 필요 없는 공개 데이터라 별도 인증 없이 바로 동작한다.
 */
export function PongdangShopSyncButton() {
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setToast(null);

    try {
      const response = await fetch("/api/discount-policies/sync-pongdang-shop", {
        method: "POST",
      });
      const body = (await response.json()) as SyncResponse | { error: string };

      if (!response.ok || "error" in body) {
        const message = "error" in body ? body.error : "동기화에 실패했습니다.";
        throw new Error(message);
      }

      const summary = body.brandRates
        .slice(0, 3)
        .map((r) => `${r.brand} ${r.ratePercent}%`)
        .join(", ");
      const more = body.brandRates.length > 3 ? ` 외 ${body.brandRates.length - 3}개 브랜드` : "";

      setToast({
        tone: "success",
        message: `${summary}${more} 할인율 동기화 완료!`,
      });

      // 방금 갱신된 정책 값이 목록 화면에 바로 보이도록 새로고침한다.
      // (토스트를 잠깐이라도 보여준 뒤 새로고침하도록 살짝 지연한다.)
      window.setTimeout(() => window.location.reload(), 1200);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "동기화 중 알 수 없는 오류가 발생했습니다.";
      setToast({ tone: "error", message });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={handleSync}
        disabled={isSyncing}
        className="self-start bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
      >
        {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw className="size-4" />}
        {isSyncing
          ? "브랜드별 할인율 표시를 실시간으로 수집 중..."
          : "퐁당닷컴 할인율 동기화"}
      </Button>

      <InlineToast toast={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
