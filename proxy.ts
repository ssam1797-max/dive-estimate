import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16부터 middleware.ts 가 proxy.ts 로 이름이 변경되었습니다.
// (기능은 동일하며, 파일/함수 이름만 변경되었습니다.)
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
