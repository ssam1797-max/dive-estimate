import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SyncRunRecord } from "@/lib/equipment/types";

interface SyncStatusCardProps {
  latestRun: SyncRunRecord | null;
  recentRuns: SyncRunRecord[];
  pendingReviewCount: number;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatDateTime(iso: string): string {
  // "2026. 10. 04. 09:00" -> "2026-10-04 09:00"
  const parts = dateTimeFormatter.formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

function runSummaryMessage(run: SyncRunRecord): string {
  if (run.status === "error") return run.message ?? "동기화에 실패했습니다.";
  return `${run.totalParsed.toLocaleString("ko-KR")}건 처리 완료 (신규 ${run.insertedCount.toLocaleString(
    "ko-KR"
  )} · 갱신 ${run.updatedCount.toLocaleString("ko-KR")} · 확인필요 ${run.protectedCount.toLocaleString(
    "ko-KR"
  )} · 실패 ${run.failedCount.toLocaleString("ko-KR")})`;
}

/**
 * "실시간 카탈로그 동기화" 버튼 아래, 예전에는 PDF 드래그 앤 드롭 업로드
 * 영역이 있던 자리에 들어가는 카드. CatalogSyncPanel 이 동기화를 끝낼 때마다
 * router.refresh() 를 호출해 이 카드(서버 컴포넌트)를 최신 상태로 다시
 * 그린다 — 클라이언트 쪽에 따로 상태를 들고 있지 않는다.
 */
export function SyncStatusCard({ latestRun, recentRuns, pendingReviewCount }: SyncStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>데이터 동기화 현황</CardTitle>
        <CardDescription>
          가장 최근 퐁당닷컴 동기화 결과와 확인이 필요한 품목 수를 보여줍니다.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              최신 동기화 일시
            </p>
            <p className="mt-1 text-sm font-semibold">
              {latestRun
                ? `${formatDateTime(latestRun.finishedAt)} ${
                    latestRun.status === "success" ? "완료" : "실패"
                  }`
                : "아직 동기화한 적이 없습니다"}
            </p>
          </div>

          <div className="rounded-md border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground">동기화된 품목 / 카테고리</p>
            <p className="mt-1 text-sm font-semibold">
              {latestRun
                ? `${latestRun.totalParsed.toLocaleString("ko-KR")}건 · ${latestRun.distinctCategoryCount}개 카테고리`
                : "-"}
            </p>
          </div>

          <Link
            href="/equipment/review"
            className="rounded-md border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
          >
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5" />
              가격 변동 확인 필요
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold">
              {pendingReviewCount > 0 ? (
                <Badge variant="destructive" className="rounded-full">
                  🔴 확인 필요 {pendingReviewCount}건
                </Badge>
              ) : (
                <span className="text-muted-foreground">확인 필요한 품목이 없습니다</span>
              )}
            </p>
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">최근 동기화 실행 로그</p>
          {recentRuns.length === 0 ? (
            <p className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
              아직 실행 기록이 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {recentRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex items-start gap-2 rounded-md border px-3 py-2 text-xs"
                >
                  {run.status === "success" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-teal-500" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  )}
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-muted-foreground">{formatDateTime(run.finishedAt)}</span>
                    <span className="break-words">{runSummaryMessage(run)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
