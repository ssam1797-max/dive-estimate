/**
 * NEXT_PUBLIC_SUPABASE_URL 에 스킴(https://)이 빠진 채로 설정되는 경우가
 * 있다(배포 환경 변수 입력 시 실수로 잘라먹는 사례). 스킴이 없으면 그대로
 * fetch 에 넘겨졌을 때 상대 경로로 오인되어 요청이 깨지므로, 스킴이 없을
 * 때만 https:// 를 붙여 보정한다.
 */
export function ensureHttpsScheme(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}
