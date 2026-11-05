import { NextResponse } from "next/server";
import {
  DETAIL_FETCH_CONCURRENCY,
  DETAIL_FETCH_DELAY_MS,
  fetchDetailPageOptions,
  isBlockingError,
} from "@/lib/crawler/pongdangCrawler";
import { getOptionBackfillTargets, saveOptionBackfillResult } from "@/lib/db/equipment-repo";
import { applyDetailOptions } from "@/lib/equipment/optionMerge";
import { requireAdminOrCronSecret } from "@/lib/auth/admin-session";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 호출 1번에 확인할 품목 수. 목록 크롤링이 없어 30초 제한 안에 충분히 끝난다. */
const ITEMS_PER_CALL = 12;
const DAY_MS = 24 * 60 * 60 * 1000;
/** 확인한 지 이만큼 지난 품목은 옵션이 바뀌었을 수 있어 다시 확인한다. */
const RECHECK_AFTER_MS = 7 * DAY_MS;
/** 요청에 실패한 품목은 줄 맨 앞을 막지 않도록 뒤로 보내고 하루 뒤 다시 시도한다. */
const RETRY_AFTER_MS = 1 * DAY_MS;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 상세페이지를 열어 옵션을 채운다. 목록 크롤링과 분리되어 있어 호출마다
 * 12건씩 처리하며, pongdang-option-backfill-background.mts 가 반복 호출한다.
 */
export async function POST(request: Request) {
  const denied = await requireAdminOrCronSecret(request);
  if (denied) return denied;

  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const { targets, remaining } = await getOptionBackfillTargets(
      new Date(now).getFullYear(),
      ITEMS_PER_CALL,
      new Date(now - RECHECK_AFTER_MS).toISOString()
    );

    let checkedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    let blocked = false;
    const retryAtIso = new Date(now - RECHECK_AFTER_MS + RETRY_AFTER_MS).toISOString();

    for (let i = 0; i < targets.length && !blocked; i += DETAIL_FETCH_CONCURRENCY) {
      const batch = targets.slice(i, i + DETAIL_FETCH_CONCURRENCY);
      const settled = await Promise.allSettled(
        batch.map((target) => fetchDetailPageOptions(target.goodsId))
      );

      for (const [index, result] of settled.entries()) {
        const target = batch[index];

        if (result.status === "rejected") {
          // 차단 응답은 품목 문제가 아니라서 기록을 남기지 않고 멈춘다.
          if (isBlockingError(result.reason)) {
            blocked = true;
            continue;
          }
          failedCount += 1;
          await saveOptionBackfillResult(target.id, retryAtIso);
          continue;
        }

        const options = applyDetailOptions(target, result.value.axis, result.value.labels);
        await saveOptionBackfillResult(target.id, nowIso, options);
        checkedCount += 1;
        if (options !== target) updatedCount += 1;
      }

      if (!blocked && i + DETAIL_FETCH_CONCURRENCY < targets.length) {
        await sleep(DETAIL_FETCH_DELAY_MS);
      }
    }

    return NextResponse.json({
      checkedCount,
      updatedCount,
      failedCount,
      blocked,
      remaining: Math.max(remaining - checkedCount - failedCount, 0),
    });
  } catch (error) {
    console.error("옵션 보완 중 예외 발생:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `옵션 보완 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
