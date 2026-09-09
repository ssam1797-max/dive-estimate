import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EquipmentImportSummary } from "@/lib/equipment/types";

interface ImportResultSummaryProps {
  summary: EquipmentImportSummary;
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "destructive"
        ? "text-destructive"
        : "text-foreground";

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border p-3">
      <span className={`text-2xl font-semibold ${toneClass}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export function ImportResultSummary({ summary }: ImportResultSummaryProps) {
  const failedItems = summary.items.filter((item) => item.status === "failed");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          업로드 결과 · {summary.brand} ({summary.catalogYear}년)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="총 인식 항목" value={summary.totalParsed} tone="default" />
          <StatTile label="신규 등록" value={summary.insertedCount} tone="success" />
          <StatTile label="업데이트" value={summary.updatedCount} tone="default" />
          <StatTile label="실패" value={summary.failedCount} tone="destructive" />
        </div>

        {summary.warnings.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" />
              일부 구간 처리 중 경고
            </div>
            <ul className="list-inside list-disc space-y-1">
              {summary.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {failedItems.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-destructive">
              <XCircle className="size-4" />
              저장 실패한 항목
            </div>
            <ul className="space-y-1">
              {failedItems.map((item, index) => (
                <li key={index} className="flex flex-col">
                  <span className="font-medium">
                    [{item.category}] {item.name}
                  </span>
                  {item.message && (
                    <span className="text-xs text-muted-foreground">
                      {item.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {summary.items
            .filter((item) => item.status !== "failed")
            .slice(0, 30)
            .map((item, index) => (
              <Badge
                key={index}
                variant={item.status === "inserted" ? "success" : "secondary"}
                title={item.category}
              >
                {item.status === "inserted" ? (
                  <CheckCircle2 className="mr-1 size-3" />
                ) : null}
                {item.name}
              </Badge>
            ))}
          {summary.items.length > 30 && (
            <Badge variant="outline">
              +{summary.items.length - 30}건 더 있음
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
