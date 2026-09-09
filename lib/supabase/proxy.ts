import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 매 요청마다 Supabase 인증 세션(쿠키)을 갱신합니다.
 * 루트의 proxy.ts 에서 호출됩니다. (Next.js 16부터 middleware.ts 가
 * proxy.ts 로 이름이 변경되었습니다.)
 *
 * 로그인 여부에 따른 라우트 보호(리다이렉트) 로직은 로그인 화면이
 * 준비되면 이 함수 안에 추가하세요.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    // 환경 변수가 아직 설정되지 않은 초기 개발 단계에서는 세션 갱신을 건너뜁니다.
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  // 세션을 갱신하기 위해 사용자 정보를 조회합니다. (getUser 는 매번 서버에
  // 토큰 유효성을 검증하므로 getSession 보다 안전합니다.)
  await supabase.auth.getUser();

  return supabaseResponse;
}
