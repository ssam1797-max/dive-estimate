import { NextResponse } from "next/server";
import { checkEstimateEditAccess } from "@/lib/estimates/estimateAccess";

export const runtime = "nodejs";

/**
 * POST /api/estimates/[id]/verify-password
 * 아무것도 바꾸지 않고 "이 비밀번호로 이 견적서를 수정/삭제할 수 있는지"만
 * 확인한다 — "이어서 수정" 화면이 편집 폼을 보여주기 전에 먼저 호출해,
 * 사용자가 품목을 다 고친 뒤에야 비밀번호가 틀렸다는 걸 알게 되는 일을 막는다.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const password =
      typeof (body as { password?: unknown })?.password === "string"
        ? (body as { password: string }).password
        : undefined;

    const access = await checkEstimateEditAccess(id, password);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("견적서 비밀번호 확인 API 오류:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
