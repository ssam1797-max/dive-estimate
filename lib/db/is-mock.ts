/**
 * Supabase 환경변수가 모두 설정되어 있으면 실제 DB 모드,
 * 하나라도 없으면 Mock(인메모리) 모드로 동작합니다.
 * .env.local 에 실제 키를 입력하면 코드 변경 없이 즉시 실제 DB로 전환됩니다.
 */
export function isMockMode(): boolean {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SECRET_KEY
  );
}
