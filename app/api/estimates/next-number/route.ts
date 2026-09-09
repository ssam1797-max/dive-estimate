import { NextResponse } from "next/server";
import { getNextEstimateNumber } from "@/lib/estimates/generateEstimateNumber";
import { nextEstimateNumberQuerySchema } from "@/lib/estimates/schema";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = nextEstimateNumberQuerySchema.safeParse({
      date: searchParams.get("date"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    const estimateNumber = await getNextEstimateNumber(parsed.data.date);

    return NextResponse.json({ estimateNumber }, { status: 200 });
  } catch (error) {
    console.error("견적서 번호 생성 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
