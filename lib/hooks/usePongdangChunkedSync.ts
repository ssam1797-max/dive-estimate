"use client";

import * as React from "react";
import { PONGDANG_CATEGORY_CODES } from "@/lib/equipment/pongdangCategories";
import type {
  EquipmentImportChunkSummary,
  EquipmentImportSummary,
} from "@/lib/equipment/types";
import type { SyncStatus } from "@/lib/hooks/useCatalogSync";

type SyncRunResult =
  | { ok: true; summary: EquipmentImportSummary }
  | { ok: false; message: string };

/**
 * 퐁당닷컴 동기화 전용 훅. /api/equipment/import/pongdang 가 "카테고리 하나,
 * 페이지 몇 장"만 처리하는 조각 단위 API로 바뀐 이유는 pongdangCrawler.ts의
 * crawlPongdangCategoryChunk 주석 참고(Netlify 서버 함수 실행 시간 제한으로
 * 504 Gateway Timeout 이 나던 문제) — 이 훅이 카테고리 × 페이지 범위를
 * nextPage 가 null이 될 때까지 순차 호출하며 그 결과를 직접 합산해, 기존
 * useCatalogSync(스쿠버프로 등 단일 호출용)와 동일한 모양의 최종
 * EquipmentImportSummary 를 만들어준다 — 호출부(SyncResultDialog 등)는
 * 수정할 필요가 없다.
 */
export function usePongdangChunkedSync() {
  const [status, setStatus] = React.useState<SyncStatus>("idle");
  const [summary, setSummary] = React.useState<EquipmentImportSummary | null>(null);
  const [progress, setProgress] = React.useState<string | null>(null);

  const run = React.useCallback(async (): Promise<SyncRunResult> => {
    setStatus("loading");
    setProgress(null);

    const catalogYear = new Date().getFullYear();
    let totalPages = 0;
    let totalParsed = 0;
    let insertedCount = 0;
    let updatedCount = 0;
    let protectedCount = 0;
    let failedCount = 0;
    const items: EquipmentImportSummary["items"] = [];
    const warnings: string[] = [];
    const brands = new Set<string>();

    try {
      for (const category of PONGDANG_CATEGORY_CODES) {
        let page: number | null = 1;

        while (page !== null) {
          setProgress(`퐁당닷컴 ${category} 카테고리 ${page}페이지 수집 중... (누적 ${totalParsed}건)`);

          const response = await fetch(
            `/api/equipment/import/pongdang?category=${category}&page=${page}`,
            { method: "POST" }
          );
          const body = (await response.json()) as EquipmentImportChunkSummary | { error: string };

          if (!response.ok || "error" in body) {
            const message = "error" in body ? body.error : "동기화에 실패했습니다.";
            throw new Error(message);
          }

          totalPages += body.pagesFetched;
          totalParsed += body.totalParsed;
          insertedCount += body.insertedCount;
          updatedCount += body.updatedCount;
          protectedCount += body.protectedCount;
          failedCount += body.failedCount;
          items.push(...body.items);
          warnings.push(...body.warnings);
          body.brands.forEach((b) => brands.add(b));

          page = body.nextPage;
        }
      }

      const finalSummary: EquipmentImportSummary = {
        brand: `퐁당닷컴 (${brands.size}개 브랜드)`,
        catalogYear,
        totalPages,
        totalParsed,
        insertedCount,
        updatedCount,
        protectedCount,
        failedCount,
        items,
        warnings,
      };

      if (finalSummary.totalParsed === 0) {
        throw new Error(
          "퐁당닷컴에서 가격 정보가 포함된 스쿠버 장비를 가져오지 못했습니다. 사이트 구조가 변경되었을 수 있습니다."
        );
      }

      setSummary(finalSummary);
      setStatus("success");
      return { ok: true, summary: finalSummary };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "동기화 중 알 수 없는 오류가 발생했습니다.";
      setStatus("error");
      return { ok: false, message };
    } finally {
      setProgress(null);
    }
  }, []);

  return { status, summary, progress, run };
}
