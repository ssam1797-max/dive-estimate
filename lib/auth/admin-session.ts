import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const ADMIN_COOKIE_NAME = "admin_session";
/** 관리자 세션 유지 시간(12시간). 이후에는 다시 비밀번호를 입력해야 한다. */
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function getAdminPassword(): string {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.error("ADMIN_PASSWORD 환경 변수 누락");
    throw new Error(
      "ADMIN_PASSWORD 환경 변수가 설정되지 않았습니다. 배포 환경(예: Netlify/Vercel)의 " +
        "Site configuration > Environment variables 설정을 확인하세요."
    );
  }
  return password;
}

/** 비밀번호 자체를 쿠키에 담지 않기 위해, "만료시각.서명" 형태의 토큰을 만든다. */
function sign(expiresAt: number): string {
  const secret = getAdminPassword();
  const hmac = createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
  return `${expiresAt}.${hmac}`;
}

function verify(token: string): boolean {
  const [expiresAtRaw, hmac] = token.split(".");
  if (!expiresAtRaw || !hmac) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  let secret: string;
  try {
    secret = getAdminPassword();
  } catch {
    return false;
  }

  const expected = createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(hmac, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}

/** 로그인 성공 시 쿠키에 저장할 새 세션 토큰을 발급한다. */
export function createAdminSessionToken(): string {
  return sign(Date.now() + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
}

/** 입력한 비밀번호가 ADMIN_PASSWORD 와 일치하는지 타이밍 공격에 안전하게 비교한다. */
export function verifyAdminPassword(input: string): boolean {
  const secret = getAdminPassword();
  const inputBuf = Buffer.from(input);
  const secretBuf = Buffer.from(secret);
  if (inputBuf.length !== secretBuf.length) return false;
  return timingSafeEqual(inputBuf, secretBuf);
}

/**
 * 서버 컴포넌트 / 라우트 핸들러에서 현재 요청이 관리자 모드인지 확인한다.
 * ADMIN_PASSWORD 가 설정되지 않은 환경(로컬 초기 세팅 등)에서는 관리자 모드
 * 진입 자체가 불가능하므로 안전하게 false 를 반환한다(예외로 화면을 막지 않음).
 */
export async function getIsAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token) return false;
    return verify(token);
  } catch {
    return false;
  }
}

/**
 * 라우트 핸들러 맨 위에서 호출해, 관리자가 아니면 즉시 401 응답을 돌려주는
 * 가드. `const denied = await requireAdmin(); if (denied) return denied;` 형태로 사용한다.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const isAdmin = await getIsAdmin();
  if (isAdmin) return null;
  return NextResponse.json(
    { error: "관리자 모드에서만 사용할 수 있는 기능입니다." },
    { status: 401 }
  );
}
