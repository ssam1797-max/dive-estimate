import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16부터 middleware.ts 가 proxy.ts 로 이름이 변경되었습니다.
// (기능은 동일하며, 파일/함수 이름만 변경되었습니다.)
export async function proxy(request: NextRequest) {
  // 도메인 루트("/")는 소개 화면 없이 바로 "견적서 작성" 화면으로 보낸다.
  // app/page.tsx 에도 동일한 redirect() 가 있지만, 루트 레이아웃이 비동기
  // (admin 쿠키 조회)라 스트리밍 응답으로 처리되면서 Next.js가 즉시
  // HTTP 리다이렉트 대신 1초 지연 메타 리프레시로 폴백하는 경우가 있다 —
  // 여기 proxy 단계에서 렌더링 전에 처리하면 항상 즉시(307) 이동한다.
  if (request.nextUrl.pathname === "/") {
    return NextResponse.redirect(new URL("/estimates/new", request.url));
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
