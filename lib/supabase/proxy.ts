import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ensureHttpsScheme } from "@/lib/supabase/normalize-url";

/**
 * 매 요청마다 Supabase 인증 세션(쿠키)을 갱신합니다.
 * 루트의 proxy.ts 에서 호출됩니다. (Next.js 16부터 middleware.ts 가
 * proxy.ts 로 이름이 변경되었습니다.)
 *
 * 로그인 여부에 따른 라우트 보호(리다이렉트) 로직은 로그인 화면이
 * 준비되면 이 함수 안에 추가하세요.
 *
 * 로그인 화면이 아직 없어서 세션 쿠키를 실제로 읽는 화면/컴포넌트가 하나도
 * 없다(모든 데이터 조회는 서비스 롤 키를 쓰는 createAdminClient 경유라
 * 사용자 세션과 무관하다 — lib/supabase/client.ts, lib/supabase/server.ts
 * 의 createClient 는 현재 아무 곳에서도 import 되지 않는다). 그런데 이
 * 함수는 거의 모든 페이지 이동마다 실행돼, supabase.auth.getUser() 가 매번
 * Supabase Auth 서버로 실제 네트워크 왕복을 한 번씩 만들어 — 아무 효과도
 * 없이 모든 내비게이션에 지연만 더하고 있었다. 로그인 기능을 붙일 때
 * 아래 getUser() 호출을 다시 켜면 된다(그 전까지는 쿠키 refresh 배관만
 * 살려두고 실제 호출은 건너뛴다).
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

  // 로그인 기능이 추가되기 전까지는 세션을 실제로 조회할 이유가 없으므로,
  // Supabase 클라이언트 생성 및 getUser() 네트워크 호출 자체를 건너뛴다.
  // (아래 createServerClient 설정은 로그인 붙일 때 그대로 재사용하면 된다.)
  const skipSessionCheck = true;
  if (skipSessionCheck) {
    return supabaseResponse;
  }

  const supabase = createServerClient(ensureHttpsScheme(supabaseUrl), supabasePublishableKey, {
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
  // 이 proxy 는 "/" 를 포함한 거의 모든 요청에서 실행되므로, 여기서 던진
  // 예외를 잡지 않으면 Supabase 호출 하나가 실패했을 때 사이트 전체가
  // Unhandled Server Error 로 죽는다 — 세션 갱신은 부가 기능이니 실패해도
  // 요청은 그대로 통과시킨다.
  try {
    await supabase.auth.getUser();
  } catch (error) {
    console.error("proxy: Supabase 세션 갱신 실패:", error);
  }

  return supabaseResponse;
}
