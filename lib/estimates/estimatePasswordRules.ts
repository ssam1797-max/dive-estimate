/**
 * 견적서 비밀번호 형식(숫자 4~6자리) — 서버(해시/검증)와 클라이언트(입력
 * 폼 검증) 양쪽에서 공유한다. 해시 로직(lib/estimates/estimatePassword.ts)은
 * "server-only" 라 클라이언트 컴포넌트에서 바로 import 할 수 없어 이 상수만
 * 별도 파일로 분리했다.
 */
export const ESTIMATE_PASSWORD_REGEX = /^\d{4,6}$/;
export const ESTIMATE_PASSWORD_HELP_TEXT = "숫자 4~6자리로 입력하세요.";

/**
 * [장바구니에서 구매요청]으로 저장하는 견적서는 고객이 직접 수정/삭제할 일이
 * 없고(관리자만 보관함에서 다룸) 비밀번호를 손수 정하게 하면 번거롭기만
 * 하다 — 그래서 화면에 보여주지 않는 6자리 숫자를 자동으로 만들어 저장만
 * 해둔다. 관리자 모드는 이 값과 무관하게 항상 수정/삭제할 수 있다.
 */
export function generateRandomEstimatePassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
