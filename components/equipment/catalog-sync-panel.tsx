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
import { SyncResultDialog } from "@/components/equipment/sync-result-dialog";
import { usePongdangChunkedSync } from "@/lib/hooks/usePongdangChunkedSync";
import type { EquipmentImportSummary } from "@/lib/equipment/types";

/**
 * "공식 홈페이지 데이터 동기화"(스쿠버프로 공식 홈페이지 크롤링)는 제거됐다
 * — 이제 퐁당닷컴 동기화만 제공한다.
 */
export function CatalogSyncPanel() {
  const pongdang = usePongdangChunkedSync();
  const [toast, setToast] = React.useState<ToastState | null>(null);
  const [resultDialog, setResultDialog] = React.useState<{
    key: string;
    summary: EquipmentImportSummary;
  } | null>(null);

  const isPongdangLoading = pongdang.status === "loading";

  const handleRun = async () => {
    setToast(null);
    const result = await pongdang.run();
    if (result.ok) {
      setResultDialog({ key: crypto.randomUUID(), summary: result.summary });
    } else {
      setToast({ tone: "error", message: `퐁당닷컴 동기화 실패: ${result.message}` });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>실시간 카탈로그 동기화</CardTitle>
          <CardDescription>
            국내 다이빙 몰의 최신 상품·가격 데이터를 불러와 장비 마스터에 반영합니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              onClick={handleRun}
              disabled={isPongdangLoading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
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

          {isPongdangLoading && pongdang.progress ? (
            <p className="text-xs text-muted-foreground">{pongdang.progress}</p>
          ) : (
            isPongdangLoading && (
              <p className="text-xs text-muted-foreground">
                카테고리·페이지별로 순차 요청 중입니다. 상품 수에 따라 최대 몇 분 정도
                걸릴 수 있습니다.
              </p>
            )
          )}
        </CardContent>
      </Card>

      {pongdang.status === "success" && pongdang.summary && (
        <ImportResultSummary summary={pongdang.summary} />
      )}

      <InlineToast toast={toast} onDismiss={() => setToast(null)} />

      {resultDialog && (
        <SyncResultDialog
          key={resultDialog.key}
          open
          onOpenChange={(open) => {
            if (!open) setResultDialog(null);
          }}
          summary={resultDialog.summary}
          onPriceApplied={(count) =>
            setToast({ tone: "success", message: `${count}건의 가격이 퐁당닷컴 최신가로 반영되었습니다.` })
          }
          onPriceApplyError={(message) =>
            setToast({ tone: "error", message: `가격 반영 실패: ${message}` })
          }
        />
      )}
    </div>
  );
}
