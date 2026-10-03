import { NextResponse } from "next/server";
import { crawlPongdangCategoryChunk } from "@/lib/crawler/pongdangCrawler";
import { upsertEquipmentMultiBrand } from "@/lib/db/equipment-repo";
import {
  PONGDANG_CATEGORY_CODES,
  type PongdangCategoryCode,
} from "@/lib/equipment/pongdangCategories";
import type { EquipmentImportChunkSummary } from "@/lib/equipment/types";
import { requireAdmin } from "@/lib/auth/admin-session";

// 카테고리 하나를 여러 페이지로 나눠 크롤링하고 한 번에 upsert 하므로 기본
// 제한보다 넉넉한 처리 시간이 필요합니다. 다만 호출 1번은 PAGES_PER_CHUNK
// 장만 처리해 보통 몇 초 안에 끝나며, 전체 카테고리는 클라이언트가 nextPage를
// 받아 이 엔드포인트를 반복 호출해 이어서 완성합니다(아래 PAGES_PER_CHUNK 주석 참고).
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * 호출 1번에 크롤링할 퐁당닷컴 목록 페이지 수.
 *
 * 예전에는 카테고리 전체(c0002 기준 최대 29페이지)를 한 호출 안에서 다
 * 처리했는데, Netlify 서버 함수 실행 시간 제한을 넘겨 504 Gateway Timeout
 * 으로 중간에 끊기는 문제가 실측으로 확인됐다. 원인을 실측해보니 페이지
 * 크롤링 자체(페이지당 약 5초, pongdang.com 응답이 느림)보다, 크롤링 결과에
 * 섞인 브랜드 수만큼 DB 왕복(브랜드별 보호 품목 조회+upsert)이 반복되는
 * 쪽이 훨씬 컸다(조각 하나에 브랜드 100개가 섞이면 왕복 100번) — 이건
 * upsertEquipmentMultiBrand() 로 브랜드 수와 무관하게 왕복 2번으로
 * 줄였고, 남은 건 순수 페이지 크롤링 시간뿐이라 3페이지면 넉넉하다.
 */
const PAGES_PER_CHUNK = 3;

function isPongdangCategoryCode(value: string): value is PongdangCategoryCode {
  return (PONGDANG_CATEGORY_CODES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { searchParams } = new URL(request.url);
    const categoryParam = searchParams.get("category") ?? "";
    const pageParam = searchParams.get("page");
    const startPage = pageParam ? Math.max(1, Math.trunc(Number(pageParam)) || 1) : 1;

    if (!isPongdangCategoryCode(categoryParam)) {
      return NextResponse.json(
        {
          error: `category 파라미터가 올바르지 않습니다. (${PONGDANG_CATEGORY_CODES.join(", ")} 중 하나여야 합니다)`,
        },
        { status: 400 }
      );
    }

    const catalogYear = new Date().getFullYear();
    const chunk = await crawlPongdangCategoryChunk(categoryParam, startPage, PAGES_PER_CHUNK);

    // 조각 하나에 브랜드가 몇 개 섞여 있든 DB 왕복 2번(보호 품목 조회 1번 +
    // upsert 1번)으로 끝낸다 — 브랜드별로 루프 돌리던 예전 방식이 504
    // Gateway Timeout 의 주된 원인이었다(위 PAGES_PER_CHUNK 주석 참고).
    const result = await upsertEquipmentMultiBrand(
      catalogYear,
      chunk.items.map(({ brand, category, name, price_retail, colors, sizes, image_url }) => ({
        brand,
        category,
        name,
        price_retail,
        colors,
        sizes,
        image_url,
      }))
    );

    const summary: EquipmentImportChunkSummary = {
      category: categoryParam,
      catalogYear,
      pagesFetched: chunk.pagesFetched,
      totalParsed: chunk.items.length,
      insertedCount: result.insertedCount,
      updatedCount: result.updatedCount,
      protectedCount: result.protectedCount,
      failedCount: result.failedCount,
      items: result.items,
      warnings: chunk.warnings,
      brands: Array.from(new Set(chunk.items.map((item) => item.brand))),
      nextPage: chunk.nextPage,
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("퐁당닷컴 동기화 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
