import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트 / 서버 액션 / 라우트 핸들러에서 사용하는 Supabase 클라이언트를 생성합니다.
 * 요청마다(호출마다) 새로 생성해서 사용하세요.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !supabasePublishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ].filter((v): v is string => Boolean(v));
    console.error("Supabase 서버 클라이언트 환경 변수 누락:", missing);
    throw new Error(
      `Supabase 환경 변수가 설정되지 않았습니다: ${missing.join(", ")}. ` +
        "배포 환경(예: Netlify)의 Site configuration > Environment variables 설정을 확인하세요."
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component 안에서 호출된 경우 쿠키를 쓸 수 없어 예외가 발생할 수
          // 있습니다. proxy.ts 에서 세션을 갱신하고 있다면 무시해도 안전합니다.
        }
      },
    },
  });
}

/**
 * RLS 를 우회해야 하는 서버 전용 관리자 작업(배치 처리 등)에서만 사용하는
 * Supabase 클라이언트입니다. SUPABASE_SECRET_KEY 를 사용하므로 절대
 * 클라이언트 컴포넌트나 브라우저로 값을 전달하지 마세요.
 */
export async function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseSecretKey) {
    const missing = [
      !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
      !supabaseSecretKey && "SUPABASE_SECRET_KEY",
    ].filter((v): v is string => Boolean(v));
    console.error("Supabase 관리자 클라이언트 환경 변수 누락:", missing);
    throw new Error(
      `Supabase 관리자 환경 변수가 설정되지 않았습니다: ${missing.join(", ")}. ` +
        "배포 환경(예: Netlify)의 Site configuration > Environment variables 설정을 확인하세요."
    );
  }

  return createServerClient(supabaseUrl, supabaseSecretKey, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {
        // 관리자 클라이언트는 쿠키(세션)를 사용하지 않습니다.
      },
    },
  });
}
