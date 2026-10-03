import { NextResponse } from "next/server";
import { updateEquipmentPriceBulk } from "@/lib/db/equipment-repo";
import { requireAdmin } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

interface PriceUpdateInput {
  id: string;
  price: number;
}

function isValidUpdate(value: unknown): value is PriceUpdateInput {
  if (typeof value !== "object" || value === null) return false;
  const { id, price } = value as Record<string, unknown>;
  return typeof id === "string" && id.length > 0 && typeof price === "number" && Number.isFinite(price);
}

/**
 * 동기화 결과의 "가격 변동 확인 필요" 탭에서 관리자가 "퐁당가 반영"을 선택한
 * 품목만 받아 price_retail 을 갱신한다. "내 가격 유지"는 아무 DB 변경이
 * 필요 없으므로 이 API를 호출하지 않는다(클라이언트에서만 처리).
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

    const updates = (body as { updates?: unknown })?.updates;
    if (!Array.isArray(updates) || updates.length === 0 || !updates.every(isValidUpdate)) {
      return NextResponse.json(
        { error: "updates 배열({ id, price }[])이 필요합니다." },
        { status: 400 }
      );
    }

    const updatedIds = await updateEquipmentPriceBulk(updates);
    return NextResponse.json({ ok: true, updatedIds });
  } catch (error) {
    console.error("가격 변동 반영 중 예외 발생:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
