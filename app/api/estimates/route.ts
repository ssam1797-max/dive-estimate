import { NextResponse } from "next/server";
import { saveEstimate } from "@/lib/estimates/saveEstimate";
import { saveRealEstimateSchema } from "@/lib/estimates/schema";
import { listSavedEstimates } from "@/lib/db/estimate-repo";
import type { SaveEstimateResult } from "@/lib/estimates/types";
import { ESTIMATE_PASSWORD_REGEX, hashEstimatePassword } from "@/lib/estimates/estimatePassword";

/** GET /api/estimates - 견적서 보관함 목록(템플릿 제외, 최신순) 조회 */
export async function GET() {
  try {
    const estimates = await listSavedEstimates();
    return NextResponse.json({ estimates });
  } catch (error) {
    console.error("견적서 보관함 목록 조회 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/estimates - 실제 견적서(발행용) 저장 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "요청 본문이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const parsed = saveRealEstimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    // 견적서 수정/삭제 보호를 위해 저장할 때마다 비밀번호(숫자 4~6자리)를 필수로 받는다.
    if (!parsed.data.editPassword || !ESTIMATE_PASSWORD_REGEX.test(parsed.data.editPassword)) {
      return NextResponse.json(
        { error: "견적서 비밀번호(숫자 4~6자리)를 입력해주세요." },
        { status: 400 }
      );
    }

    const id = await saveEstimate({
      estimateNumber: parsed.data.estimateNumber,
      date: parsed.data.date,
      providerId: parsed.data.providerId,
      receiverId: parsed.data.receiverId,
      remarks: parsed.data.remarks,
      templateName: null,
      priceTier: parsed.data.priceTier,
      items: parsed.data.items,
      editPasswordHash: hashEstimatePassword(parsed.data.editPassword),
    });

    const result: SaveEstimateResult = { id };
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("견적서 저장 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
