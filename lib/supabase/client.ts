import { createBrowserClient } from "@supabase/ssr";

/**
 * 브라우저(클라이언트 컴포넌트)에서 사용하는 Supabase 클라이언트를 생성합니다.
 * 컴포넌트 렌더링마다 새로 만들지 말고, 필요한 곳에서 매번 호출해 사용하세요.
 * (내부적으로 가벼운 객체이며, 인증 세션은 쿠키를 통해 공유됩니다.)
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      "Supabase 환경 변수가 설정되지 않았습니다. .env.local 파일에 NEXT_PUBLIC_SUPABASE_URL 과 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 를 설정해주세요."
    );
  }

  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
