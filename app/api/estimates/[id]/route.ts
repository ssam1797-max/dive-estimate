import { NextResponse } from "next/server";
import {
  getSavedEstimateDetail,
  deleteSavedEstimate,
  updateSavedEstimate,
  updateEstimateStatus,
} from "@/lib/db/estimate-repo";
import { saveRealEstimateSchema } from "@/lib/estimates/schema";
import type { EstimateStatus } from "@/lib/estimates/types";

const VALID_STATUSES: EstimateStatus[] = ["draft", "sent", "approved", "cancelled"];

/** GET /api/estimates/[id] - 견적서 보관함 상세(항목 포함) 조회 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const estimate = await getSavedEstimateDetail(id);

    if (!estimate) {
      return NextResponse.json(
        { error: "견적서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ estimate }, { status: 200 });
  } catch (error) {
    console.error("견적서 상세 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PUT /api/estimates/[id] - 저장된 실제 견적서 1건을 "이어서 수정"해 덮어쓰기 저장 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "요청 본문이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    // 신규 저장(POST /api/estimates)과 요청 바디 형태가 완전히 같아 같은
    // 검증 스키마를 그대로 재사용한다.
    const parsed = saveRealEstimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    const updatedId = await updateSavedEstimate(id, {
      estimateNumber: parsed.data.estimateNumber,
      date: parsed.data.date,
      providerId: parsed.data.providerId,
      receiverId: parsed.data.receiverId,
      remarks: parsed.data.remarks,
      priceTier: parsed.data.priceTier,
      items: parsed.data.items,
    });

    return NextResponse.json({ id: updatedId }, { status: 200 });
  } catch (error) {
    console.error("견적서 수정 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/estimates/[id] - 견적서 진행 상태(작성중/발송됨/승인됨/취소됨)만 변경 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const status = body?.status;

    if (typeof status !== "string" || !VALID_STATUSES.includes(status as EstimateStatus)) {
      return NextResponse.json(
        { error: `status 는 ${VALID_STATUSES.join(", ")} 중 하나여야 합니다.` },
        { status: 400 }
      );
    }

    const updated = await updateEstimateStatus(id, status as EstimateStatus);

    if (!updated) {
      return NextResponse.json(
        { error: "견적서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, status }, { status: 200 });
  } catch (error) {
    console.error("견적서 상태 변경 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/estimates/[id] - 견적서 보관함에서 견적서 1건 삭제 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteSavedEstimate(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "견적서를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("견적서 삭제 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
