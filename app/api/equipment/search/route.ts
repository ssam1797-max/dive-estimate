import { NextResponse } from "next/server";
import { searchEquipment } from "@/lib/db/equipment-repo";

export const runtime = "nodejs";

/**
 * 견적서 작성 화면 상단 "키워드 통합 검색"용 — 기존 /api/equipment(POST,
 * 수동 등록)와는 완전히 별개의 조회 전용 엔드포인트다. 기존 API 동작에는
 * 영향이 없다.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";

    const items = await searchEquipment(q);
    return NextResponse.json({ items });
  } catch (error) {
    console.error("장비 통합 검색 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `검색 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
