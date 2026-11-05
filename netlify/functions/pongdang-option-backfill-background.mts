import { timingSafeEqual } from "node:crypto";

/**
 * /api/equipment/option-backfill 을 반복 호출해 옵션을 채우는 백그라운드
 * 함수(최대 15분). 퐁당닷컴이 429/403으로 거부하거나 연속으로 실패하면 멈추고,
 * 다음 시간에 다시 시작한다. 진행 상태는 equipment.option_checked_at 에 남으므로
 * 중간에 끊겨도 이어서 진행된다.
 */
export const config = {
  background: true,
};

const RUN_BUDGET_MS = 13 * 60 * 1000;
const DELAY_BETWEEN_CALLS_MS = 1000;
const RETRY_DELAY_MS = 10000;
const MAX_CONSECUTIVE_FAILURES = 3;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface BackfillCallResult {
  checkedCount: number;
  updatedCount: number;
  failedCount: number;
  blocked: boolean;
  remaining: number;
}

function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");
  if (!secret || !provided) return false;
  const secretBuf = Buffer.from(secret);
  const providedBuf = Buffer.from(provided);
  return secretBuf.length === providedBuf.length && timingSafeEqual(secretBuf, providedBuf);
}

const handler = async (request: Request) => {
  if (!hasValidCronSecret(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;
  if (!siteUrl || !cronSecret) {
    return new Response("설정 누락", { status: 500 });
  }

  const startedAt = Date.now();
  const totals = { checked: 0, updated: 0, failed: 0 };
  let consecutiveFailures = 0;
  let stopReason = "시간 예산 소진";

  while (Date.now() - startedAt < RUN_BUDGET_MS) {
    try {
      const response = await fetch(`${siteUrl}/api/equipment/option-backfill`, {
        method: "POST",
        headers: { "x-cron-secret": cronSecret },
      });
      const body = JSON.parse(await response.text()) as BackfillCallResult | { error: string };
      if (!response.ok || "error" in body) {
        throw new Error("error" in body ? body.error : `HTTP ${response.status}`);
      }

      consecutiveFailures = 0;
      totals.checked += body.checkedCount;
      totals.updated += body.updatedCount;
      totals.failed += body.failedCount;

      if (body.blocked) {
        stopReason = "퐁당닷컴 요청 거부(429/403)";
        break;
      }
      if (body.remaining === 0 || body.checkedCount + body.failedCount === 0) {
        stopReason = "남은 품목 없음";
        break;
      }
      await sleep(DELAY_BETWEEN_CALLS_MS);
    } catch (error) {
      consecutiveFailures += 1;
      console.error("[pongdang-option-backfill] 호출 실패:", error);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        stopReason = "연속 실패";
        break;
      }
      await sleep(RETRY_DELAY_MS);
    }
  }

  console.log(
    `[pongdang-option-backfill] 종료(${stopReason}): 확인 ${totals.checked}건, ` +
      `옵션 변경 ${totals.updated}건, 실패 ${totals.failed}건`
  );
  return new Response("ok", { status: 200 });
};

export default handler;
