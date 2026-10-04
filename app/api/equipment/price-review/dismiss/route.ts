import { NextResponse } from "next/server";
import { dismissPendingReview } from "@/lib/db/equipment-repo";
import { requireAdmin } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

/**
 * "확인 필요 품목" 탭에서 "현재가 유지"(확인 완료, 가격은 그대로)를 선택한
 * 품목의 id만 받아 pending_review_* 를 비운다. price_retail 은 건드리지
 * 않는다 — 가격 자체를 바꾸는 쪽은 /api/equipment/price-review 가 맡는다.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    const ids = (body as { ids?: unknown })?.ids;
    if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: "ids 배열(string[])이 필요합니다." }, { status: 400 });
    }

    const dismissedIds = await dismissPendingReview(ids);
    return NextResponse.json({ ok: true, dismissedIds });
  } catch (error) {
    console.error("확인 필요 품목 해제 중 예외 발생:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
