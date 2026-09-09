import { NextResponse } from "next/server";
import { crawlPongdangBrandDiscountRates } from "@/lib/crawler/pongdangCrawler";
import {
  findDiscountPolicyByBrandOrAlias,
  upsertDiscountPolicy,
} from "@/lib/db/discount-policy-repo";

// 카테고리 여러 페이지를 순차 요청하므로 넉넉한 처리 시간이 필요합니다.
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  try {
    const { brandRates, warnings, pagesFetched } = await crawlPongdangBrandDiscountRates();

    if (brandRates.length === 0) {
      return NextResponse.json(
        {
          error: "브랜드별 할인율을 하나도 수집하지 못했습니다.",
          warnings,
        },
        { status: 422 }
      );
    }

    const updatedBrands: string[] = [];
    const upsertWarnings: string[] = [];

    for (const { brand, ratePercent } of brandRates) {
      try {
        // 별칭까지 확인해서 기존 정책 행이 있으면 그 행의 다른 탭(소비자가/강사가/원가)과
        // 별칭은 보존한 채 센터가만 갱신한다. 없으면 센터가만 채운 새 행을 만든다.
        const existing = await findDiscountPolicyByBrandOrAlias(brand);
        await upsertDiscountPolicy({
          brand: existing?.brand ?? brand,
          aliases: existing?.aliases ?? [],
          rate_retail: existing?.rate_retail ?? 0,
          rate_instructor: existing?.rate_instructor ?? 0,
          rate_center: ratePercent,
          rate_cost: existing?.rate_cost ?? 0,
        });
        updatedBrands.push(existing?.brand ?? brand);
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        upsertWarnings.push(`"${brand}" 할인율 저장 실패: ${message}`);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        brandRates,
        updatedBrands,
        pagesFetched,
        warnings: [...warnings, ...upsertWarnings],
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("퐁당닷컴 할인율 동기화 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
