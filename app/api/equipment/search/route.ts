import { NextResponse } from "next/server";
import { searchEquipment } from "@/lib/db/equipment-repo";

export const runtime = "nodejs";

/**
 * 견적서 작성 화면 상단 "키워드 통합 검색"용 — 기존 /api/equipment(POST,
 * 수동 등록)와는 완전히 별개의 조회 전용 엔드포인트다. 기존 API 동작에는
 * 영향이 없다.
 *
 * limit: 호출부가 필요한 결과 개수를 지정할 수 있다(기본 20건 — 견적서
 * 작성 화면의 검색 드롭다운용). "장비 목록(수정/삭제)" 화면처럼 브랜드
 * 하나로만 검색해도 전체를 훑어봐야 하는 경우 더 큰 값을 넘긴다.
 * total 은 이 검색어에 실제로 매칭되는 전체 건수라, items.length 보다
 * 크면 화면에서 일부가 잘려 안 보인다는 뜻이다.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const { items, total } = await searchEquipment(q, limit);
    return NextResponse.json({ items, total });
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
