import { NextResponse } from "next/server";
import { crawlScubaproCatalog } from "@/lib/crawler/scubaproCrawler";
import { upsertEquipment } from "@/lib/equipment/upsertEquipment";
import { SCUBAPRO_SYNC_BRAND } from "@/lib/equipment/constants";
import type { EquipmentImportSummary } from "@/lib/equipment/types";

// 여러 카테고리 페이지를 순차적으로(요청 간 딜레이를 두고) 크롤링하므로
// 기본 제한보다 넉넉한 처리 시간이 필요합니다.
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const catalogYear = new Date().getFullYear();

    const crawlResult = await crawlScubaproCatalog();

    if (crawlResult.items.length === 0) {
      return NextResponse.json(
        {
          error:
            "공식 홈페이지에서 가격 정보가 포함된 장비 항목을 가져오지 못했습니다. 사이트 구조가 변경되었을 수 있습니다.",
          warnings: crawlResult.warnings,
        },
        { status: 422 }
      );
    }

    const upsertResult = await upsertEquipment(
      SCUBAPRO_SYNC_BRAND,
      catalogYear,
      crawlResult.items
    );

    const summary: EquipmentImportSummary = {
      brand: SCUBAPRO_SYNC_BRAND,
      catalogYear,
      totalPages: crawlResult.targetsProcessed,
      totalParsed: crawlResult.items.length,
      insertedCount: upsertResult.insertedCount,
      updatedCount: upsertResult.updatedCount,
      failedCount: upsertResult.failedCount,
      items: upsertResult.items,
      warnings: crawlResult.warnings,
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("스쿠버프로 공식 홈페이지 동기화 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
