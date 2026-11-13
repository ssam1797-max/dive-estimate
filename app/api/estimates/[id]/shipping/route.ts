import { NextResponse } from "next/server";
import { updateEstimateShipping } from "@/lib/db/estimate-repo";
import { estimateShippingSchema } from "@/lib/estimates/schema";

/**
 * PUT /api/estimates/[id]/shipping - 견적서의 발주 배송지 변경
 *
 * 바디: { shipTo: { name, contact, address, memo } | null }
 * - shipTo 객체: 주소록에서 고른 배송지를 견적서에 스냅샷으로 저장
 * - shipTo null: 공급받는자 기본 정보(이름/연락처/주소)로 되돌림
 *
 * 상태 변경(PATCH /api/estimates/[id])과 같이, 발주 업무용 부가 정보라
 * 견적서 비밀번호 확인 없이 바꿀 수 있다(품목/금액은 바뀌지 않음).
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    const parsed = estimateShippingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    const updated = await updateEstimateShipping(id, parsed.data.shipTo);
    if (!updated) {
      return NextResponse.json({ error: "견적서를 찾을 수 없습니다." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, shipTo: parsed.data.shipTo }, { status: 200 });
  } catch (error) {
    console.error("발주 배송지 변경 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
