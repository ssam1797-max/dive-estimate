import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트를 생성합니다.
 * 컴포넌트 렌더링마다 새로 만들지 말고, 필요한 곳에서 매번 호출해 사용하세요.
 * (내부적으로 가벼운 객체이며, 인증 세션은 쿠키를 통해 공유됩니다.)
 */
// Netlify 환경 변수 수정 후 재배포 트리거용 주석 (NEXT_PUBLIC_* 은 빌드 시점에
// 고정되므로, 값만 바꾸고 재빌드하지 않으면 이전 빌드가 계속 서빙된다).
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !supabasePublishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].filter((v): v is string => Boolean(v));
    console.error("Supabase 브라우저 클라이언트 환경 변수 누락:", missing);
    throw new Error(
      `Supabase 환경 변수가 설정되지 않았습니다: ${missing.join(", ")}. ` +
        "빌드 환경(예: Netlify)에 NEXT_PUBLIC_* 변수가 설정되어 있는지 확인하세요 " +
        "(NEXT_PUBLIC_ 변수는 런타임이 아니라 빌드 시점에 값이 주입됩니다)."
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
