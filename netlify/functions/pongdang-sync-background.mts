import { timingSafeEqual } from "node:crypto";
import { PONGDANG_CATEGORY_CODES } from "../../lib/equipment/pongdangCategories";
import type { PongdangCategoryCode } from "../../lib/equipment/pongdangCategories";
import type { EquipmentImportChunkSummary } from "../../lib/equipment/types";

/**
 * 퐁당닷컴 전체 카테고리×페이지 동기화 실제 작업을 수행하는 백그라운드
 * 함수(최대 15분). pongdang-sync-trigger.mts(매일 새벽 5시 예약 함수)가
 * HTTP로 호출하며, Netlify가 즉시 202로 응답하고 이 함수는 큐에서 계속
 * 실행된다.
 *
 * lib/crawler/pongdangCrawler.ts나 lib/db/equipment-repo.ts를 직접
 * import하지 않는다 — 특히 equipment-repo.ts가 거치는
 * lib/supabase/server.ts는 next/headers의 cookies()를 최상단에서 import해
 * Next.js 요청 컨텍스트 밖(Netlify 함수 런타임)에서 위험할 수 있다. 대신
 * 이미 검증된 기존 API 라우트들을 평범한 fetch로 그대로 호출해 재사용한다
 * (usePongdangChunkedSync.ts 클라이언트 훅과 동일한 호출 순서/합산 로직).
 */
export const config = {
  background: true,
};

function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const provided = request.headers.get("x-cron-secret");
  if (!provided) return false;
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);
  if (secretBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(secretBuf, providedBuf);
}

interface RunTotals {
  totalParsed: number;
  insertedCount: number;
  updatedCount: number;
  protectedCount: number;
  failedCount: number;
}

async function persistSyncRun(
  siteUrl: string,
  headers: Record<string, string>,
  input: RunTotals & {
    startedAt: string;
    finishedAt: string;
    status: "success" | "error";
    distinctBrandCount: number;
    distinctCategoryCount: number;
    soldOutCount: number;
    restoredCount: number;
    message: string | null;
  }
): Promise<void> {
  try {
    await fetch(`${siteUrl}/api/equipment/sync-runs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ source: "pongdang", ...input }),
    });
  } catch (error) {
    console.error("[pongdang-sync-background] 동기화 실행 기록 저장 실패:", error);
  }
}

const handler = async (request: Request) => {
  if (!hasValidCronSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    console.error(
      "[pongdang-sync-background] URL 또는 CRON_SECRET 환경 변수가 설정되지 않았습니다."
    );
    return new Response("설정 누락", { status: 500 });
  }

  const headers = { "x-cron-secret": cronSecret, "Content-Type": "application/json" };
  const startedAt = new Date().toISOString();
  const categories = new Set<string>();
  const brands = new Set<string>();
  const seenKeys: { brand: string; name: string }[] = [];
  const totals: RunTotals = {
    totalParsed: 0,
    insertedCount: 0,
    updatedCount: 0,
    protectedCount: 0,
    failedCount: 0,
  };

  try {
    for (const category of PONGDANG_CATEGORY_CODES as readonly PongdangCategoryCode[]) {
      let page: number | null = 1;

      while (page !== null) {
        const response = await fetch(
          `${siteUrl}/api/equipment/import/pongdang?category=${category}&page=${page}`,
          { method: "POST", headers }
        );
        const body = (await response.json()) as EquipmentImportChunkSummary | { error: string };

        if (!response.ok || "error" in body) {
          const message = "error" in body ? body.error : "동기화에 실패했습니다.";
          throw new Error(`[${category} ${page}페이지] ${message}`);
        }

        totals.totalParsed += body.totalParsed;
        totals.insertedCount += body.insertedCount;
        totals.updatedCount += body.updatedCount;
        totals.protectedCount += body.protectedCount;
        totals.failedCount += body.failedCount;
        body.brands.forEach((b) => brands.add(b));
        body.items.forEach((item) => {
          categories.add(item.category);
          seenKeys.push({ brand: item.brand, name: item.name });
        });

        page = body.nextPage;
      }
    }

    if (totals.totalParsed === 0) {
      throw new Error(
        "퐁당닷컴에서 가격 정보가 포함된 스쿠버 장비를 가져오지 못했습니다. 사이트 구조가 변경되었을 수 있습니다."
      );
    }

    // 전체 카테고리×페이지가 끝까지 성공했을 때만 품절/재입고 반영을
    // 호출한다 — 중간에 실패한 동기화에서 호출하면 아직 못 받은 카테고리
    // 품목까지 품절로 잘못 처리될 수 있다(usePongdangChunkedSync.ts 와
    // 동일한 안전장치).
    let soldOutCount = 0;
    let restoredCount = 0;
    try {
      const reconcileResponse = await fetch(`${siteUrl}/api/equipment/reconcile-sold-out`, {
        method: "POST",
        headers,
        body: JSON.stringify({ catalogYear: new Date().getFullYear(), seenKeys }),
      });
      const reconcileBody = (await reconcileResponse.json()) as
        | { ok: true; soldOutCount: number; restoredCount: number }
        | { error: string };
      if (!reconcileResponse.ok || "error" in reconcileBody) {
        throw new Error("error" in reconcileBody ? reconcileBody.error : "품절/재입고 반영 실패");
      }
      soldOutCount = reconcileBody.soldOutCount;
      restoredCount = reconcileBody.restoredCount;
    } catch (error) {
      console.error("[pongdang-sync-background] 품절/재입고 반영 실패:", error);
    }

    const finishedAt = new Date().toISOString();
    await persistSyncRun(siteUrl, headers, {
      ...totals,
      startedAt,
      finishedAt,
      status: "success",
      distinctBrandCount: brands.size,
      distinctCategoryCount: categories.size,
      soldOutCount,
      restoredCount,
      message: null,
    });

    console.log(
      `[pongdang-sync-background] 완료: ${totals.totalParsed}건 ` +
        `(신규 ${totals.insertedCount} · 갱신 ${totals.updatedCount} · ` +
        `확인필요 ${totals.protectedCount} · 실패 ${totals.failedCount} · ` +
        `품절 ${soldOutCount} · 재입고 ${restoredCount})`
    );
    return new Response("ok", { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "동기화 중 알 수 없는 오류가 발생했습니다.";
    console.error("[pongdang-sync-background] 동기화 실패:", message);

    await persistSyncRun(siteUrl, headers, {
      ...totals,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "error",
      distinctBrandCount: brands.size,
      distinctCategoryCount: categories.size,
      soldOutCount: 0,
      restoredCount: 0,
      message,
    });

    return new Response(message, { status: 500 });
  }
};

export default handler;
