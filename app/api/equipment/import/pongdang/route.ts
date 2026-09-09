import { NextResponse } from "next/server";
import { crawlPongdangCatalog } from "@/lib/crawler/pongdangCrawler";
import { upsertEquipment } from "@/lib/equipment/upsertEquipment";
import type {
  EquipmentImportItemResult,
  EquipmentImportSummary,
} from "@/lib/equipment/types";

// 최상위 카테고리 하나를 여러 페이지로 나눠 순차 크롤링하고, 이어서 브랜드별로
// 나눠 upsert 하므로(요청 수가 많음) 기본 제한보다 넉넉한 처리 시간이 필요합니다.
export const runtime = "nodejs";
export const maxDuration = 240;

export async function POST() {
  try {
    const catalogYear = new Date().getFullYear();
    const crawlResult = await crawlPongdangCatalog();

    if (crawlResult.items.length === 0) {
      return NextResponse.json(
        {
          error:
            "퐁당닷컴에서 가격 정보가 포함된 스쿠버 장비를 가져오지 못했습니다. 사이트 구조가 변경되었을 수 있습니다.",
          warnings: crawlResult.warnings,
        },
        { status: 422 }
      );
    }

    // upsertEquipment(brand, catalogYear, items) 는 브랜드 하나를 전제로 한
    // 기존(스쿠버프로 동기화·PDF 업로드 공용) 함수라, 퐁당닷컴처럼 한 번의
    // 수집 결과에 여러 브랜드가 섞여 있는 경우 브랜드별로 묶어 각각 호출한다.
    const itemsByBrand = new Map<string, typeof crawlResult.items>();
    for (const item of crawlResult.items) {
      const bucket = itemsByBrand.get(item.brand) ?? [];
      bucket.push(item);
      itemsByBrand.set(item.brand, bucket);
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const items: EquipmentImportItemResult[] = [];

    for (const [brand, brandItems] of itemsByBrand) {
      const result = await upsertEquipment(
        brand,
        catalogYear,
        brandItems.map(({ category, name, price_retail, colors, sizes }) => ({
          category,
          name,
          price_retail,
          colors,
          sizes,
        }))
      );
      insertedCount += result.insertedCount;
      updatedCount += result.updatedCount;
      failedCount += result.failedCount;
      items.push(...result.items);
    }

    const summary: EquipmentImportSummary = {
      brand: `퐁당닷컴 (${crawlResult.distinctBrandCount}개 브랜드)`,
      catalogYear,
      totalPages: crawlResult.pagesFetched,
      totalParsed: crawlResult.items.length,
      insertedCount,
      updatedCount,
      failedCount,
      items,
      warnings: crawlResult.warnings,
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
