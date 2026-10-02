import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getBankAccountSettings,
  updateBankAccountSettings,
} from "@/lib/db/settings-repo";
import { requireAdmin } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

/**
 * 구매요청 완료 화면(주문 완료 모달)이 익명 사용자 입장에서 바로 떠야 해서
 * 조회는 로그인 없이 누구나 할 수 있다 — 계좌 정보 자체가 고객에게 보여줄
 * 용도이므로 공개해도 문제없다. 수정만 관리자 모드로 제한한다.
 */
export async function GET() {
  try {
    const settings = await getBankAccountSettings();
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const updateSchema = z.object({
  bankName: z.string().trim().max(50),
  accountNumber: z.string().trim().max(50),
  accountHolder: z.string().trim().max(50),
});

export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        { status: 400 }
      );
    }

    const settings = await updateBankAccountSettings(parsed.data);
    return NextResponse.json(settings);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
