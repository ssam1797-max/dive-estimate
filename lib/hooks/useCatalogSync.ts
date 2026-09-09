"use client";

import * as React from "react";
import type { EquipmentImportSummary } from "@/lib/equipment/types";

export type SyncStatus = "idle" | "loading" | "success" | "error";

type SyncRunResult =
  | { ok: true; summary: EquipmentImportSummary }
  | { ok: false; message: string };

/** POST 요청 한 번으로 완료되는 카탈로그 동기화 액션(스쿠버프로/퐁당닷컴 등)의 공통 상태 관리. */
export function useCatalogSync(endpoint: string) {
  const [status, setStatus] = React.useState<SyncStatus>("idle");
  const [summary, setSummary] = React.useState<EquipmentImportSummary | null>(null);

  const run = React.useCallback(async (): Promise<SyncRunResult> => {
    setStatus("loading");

    try {
      const response = await fetch(endpoint, { method: "POST" });
      const body = (await response.json()) as EquipmentImportSummary | { error: string };

      if (!response.ok || "error" in body) {
        const message = "error" in body ? body.error : "동기화에 실패했습니다.";
        throw new Error(message);
      }

      setSummary(body);
      setStatus("success");
      return { ok: true, summary: body };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "동기화 중 알 수 없는 오류가 발생했습니다.";
      setStatus("error");
      return { ok: false, message };
    }
  }, [endpoint]);

  return { status, summary, run };
}
