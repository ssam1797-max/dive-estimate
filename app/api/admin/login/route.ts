import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  createAdminSessionToken,
  verifyAdminPassword,
} from "@/lib/auth/admin-session";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        { status: 400 }
      );
    }

    if (!verifyAdminPassword(parsed.data.password)) {
      return NextResponse.json({ error: "비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(ADMIN_COOKIE_NAME, createAdminSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("관리자 로그인 API 오류:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
