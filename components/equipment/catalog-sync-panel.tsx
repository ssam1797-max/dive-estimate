"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";
import { ImportResultSummary } from "@/components/equipment/import-result-summary";
import { useCatalogSync } from "@/lib/hooks/useCatalogSync";

export function CatalogSyncPanel() {
  const scubapro = useCatalogSync("/api/equipment/sync");
  const pongdang = useCatalogSync("/api/equipment/import/pongdang");
  const [toast, setToast] = React.useState<ToastState | null>(null);

  const isScubaproLoading = scubapro.status === "loading";
  const isPongdangLoading = pongdang.status === "loading";
  const isAnyLoading = isScubaproLoading || isPongdangLoading;

  const handleRun = async (
    sync: typeof scubapro | typeof pongdang,
    label: string
  ) => {
    setToast(null);
    const result = await sync.run();
    setToast(
      result.ok
        ? {
            tone: "success",
            message: `${label} 동기화 완료: 신규 ${result.summary.insertedCount}건, 업데이트 ${result.summary.updatedCount}건.`,
          }
        : { tone: "error", message: `${label} 동기화 실패: ${result.message}` }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>실시간 카탈로그 동기화</CardTitle>
          <CardDescription>
            공식 브랜드 홈페이지와 국내 다이빙 몰의 최신 상품·가격 데이터를 불러와
            장비 마스터에 반영합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={() => handleRun(scubapro, "스쿠버프로")}
              disabled={isAnyLoading}
              className="bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {isScubaproLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {isScubaproLoading
                ? "스쿠버프로 최신 가격 데이터를 가져오는 중..."
                : "공식 홈페이지 데이터 동기화"}
            </Button>

            <Button
              type="button"
              onClick={() => handleRun(pongdang, "퐁당닷컴")}
              disabled={isAnyLoading}
              className="bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-60"
            >
              {isPongdangLoading ? (
                <Loader2 className="animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {isPongdangLoading
                ? "퐁당닷컴 최신 장비 및 가격 데이터를 수집하는 중..."
                : "퐁당닷컴 데이터 동기화"}
            </Button>
          </div>

          {isAnyLoading && (
            <p className="text-xs text-muted-foreground">
              카테고리·페이지별로 순차 요청 중입니다. 상품 수에 따라 최대 몇 분 정도
              걸릴 수 있습니다.
            </p>
          )}
        </CardContent>
      </Card>

      {scubapro.status === "success" && scubapro.summary && (
        <ImportResultSummary summary={scubapro.summary} />
      )}
      {pongdang.status === "success" && pongdang.summary && (
        <ImportResultSummary summary={pongdang.summary} />
      )}

      <InlineToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
