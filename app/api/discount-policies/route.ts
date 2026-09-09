import { NextResponse } from "next/server";
import {
  getAllDiscountPolicies,
  upsertDiscountPolicy,
} from "@/lib/db/discount-policy-repo";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET() {
  try {
    const policies = await getAllDiscountPolicies();
    return NextResponse.json(policies);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const upsertSchema = z.object({
  brand: z.string().trim().min(1, "브랜드를 입력해주세요."),
  aliases: z.array(z.string().trim()).default([]),
  rate_retail: z.number().min(0).max(100),
  rate_instructor: z.number().min(0).max(100),
  rate_center: z.number().min(0).max(100),
  rate_cost: z.number().min(0).max(100),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    const parsed = upsertSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        { status: 400 }
      );
    }

    const policy = await upsertDiscountPolicy(parsed.data);
    return NextResponse.json(policy);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
