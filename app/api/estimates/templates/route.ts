import { NextResponse } from "next/server";
import { listTemplateSummaries } from "@/lib/estimates/templateQueries";
import { saveEstimate } from "@/lib/estimates/saveEstimate";
import { saveTemplateSchema } from "@/lib/estimates/schema";
import type { SaveEstimateResult } from "@/lib/estimates/types";

/** GET /api/estimates/templates - 저장된 템플릿 목록 조회 */
export async function GET() {
  try {
    const templates = await listTemplateSummaries();
    return NextResponse.json({ templates }, { status: 200 });
  } catch (error) {
    console.error("템플릿 목록 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/estimates/templates - 현재 장비 구성을 템플릿으로 저장 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "요청 본문이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const parsed = saveTemplateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    const id = await saveEstimate({
      estimateNumber: null,
      date: null,
      providerId: null,
      receiverId: null,
      remarks: null,
      templateName: parsed.data.templateName,
      priceTier: null,
      items: parsed.data.items,
    });

    const result: SaveEstimateResult = { id };
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("템플릿 저장 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
