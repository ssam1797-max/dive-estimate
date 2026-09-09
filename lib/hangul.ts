/**
 * 한글 초성(첫소리) 검색 유틸리티.
 * 검색어가 초성으로만 이루어져 있으면(예: "ㅅㅋㅍㄹ") 대상 문자열의 초성과
 * 비교하고, 그렇지 않으면 일반 부분 문자열 일치로 검색합니다.
 */

const CHOSUNG_LIST = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ",
  "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];

const HANGUL_BASE = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG_UNIT = 588; // (종성 27 * 중성 21 + ... ) 한 초성이 차지하는 코드 범위 크기

/** 완성형 한글 문자열에서 초성만 추출합니다. 한글 음절이 아닌 문자는 그대로 둡니다. */
export function extractChosung(text: string): string {
  let result = "";
  for (const ch of text) {
    const code = ch.charCodeAt(0) - HANGUL_BASE;
    if (code >= 0 && code <= HANGUL_END - HANGUL_BASE) {
      result += CHOSUNG_LIST[Math.floor(code / CHOSUNG_UNIT)];
    } else {
      result += ch;
    }
  }
  return result;
}

const CHOSUNG_ONLY_REGEX = /^[ㄱ-ㅎ]+$/;

/**
 * 대소문자와 공백 차이를 완전히 무시하고 비교하기 위한 정규화.
 * "scubapro" / "SCUBAPRO" / "ScUbApRo" / "SCUBA PRO" 가 전부 같은 검색어로
 * 취급되도록 소문자화 + 문자열 내부의 모든 공백(연속 공백 포함)을 제거한다.
 */
function normalizeForSearch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

/** 검색어가 초성으로만 이루어져 있으면 초성 일치, 아니면 대소문자·공백 무시 부분 문자열 일치. */
export function matchesKoreanSearch(label: string, query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return true;
  if (CHOSUNG_ONLY_REGEX.test(trimmed)) {
    return normalizeForSearch(extractChosung(label)).includes(normalizeForSearch(trimmed));
  }
  return normalizeForSearch(label).includes(normalizeForSearch(trimmed));
}
