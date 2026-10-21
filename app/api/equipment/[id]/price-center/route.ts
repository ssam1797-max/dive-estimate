import { NextResponse } from "next/server";
import { updateEquipmentPriceCenter } from "@/lib/db/equipment-repo";
import { requireAdmin } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PriceCenterInput {
  /** null이면 "자동 계산으로 되돌리기" — price_center_overridden 을 해제한다. */
  price_center: number | null;
}

function isValidInput(value: unknown): value is PriceCenterInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!("price_center" in v)) return false;
  return v.price_center === null || typeof v.price_center === "number";
}

/**
 * "장비 목록" 화면의 공급가 인라인 입력칸 전용 — PUT /api/equipment/[id]
 * (전체 수정)과 달리 is_custom 을 건드리지 않는다. 공급가 하나만 수동
 * 고정하고, 색상/사이즈/소비자가/샵가는 계속 자동 동기화되게 하기 위함
 * (lib/db/equipment-repo.ts updateEquipmentPriceCenter 참고).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    if (!isValidInput(body)) {
      return NextResponse.json(
        { error: "price_center(숫자 또는 null)가 필요합니다." },
        { status: 400 }
      );
    }

    if (body.price_center !== null && (!Number.isFinite(body.price_center) || body.price_center < 0)) {
      return NextResponse.json(
        { error: "공급가는 0 이상의 숫자여야 합니다." },
        { status: 400 }
      );
    }

    await updateEquipmentPriceCenter(id, body.price_center);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if ((error as Error & { code?: string })?.code === "NOT_FOUND") {
      return NextResponse.json({ error: "장비를 찾을 수 없습니다." }, { status: 404 });
    }
    console.error("공급가 수정 중 예외 발생:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
