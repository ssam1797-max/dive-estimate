/**
 * 견적서 비밀번호 형식(숫자 4~6자리) — 서버(해시/검증)와 클라이언트(입력
 * 폼 검증) 양쪽에서 공유한다. 해시 로직(lib/estimates/estimatePassword.ts)은
 * "server-only" 라 클라이언트 컴포넌트에서 바로 import 할 수 없어 이 상수만
 * 별도 파일로 분리했다.
 */
export const ESTIMATE_PASSWORD_REGEX = /^\d{4,6}$/;
export const ESTIMATE_PASSWORD_HELP_TEXT = "숫자 4~6자리로 입력하세요.";
