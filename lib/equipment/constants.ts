/** 장비 카탈로그 업로드 기능 관련 상수 모음 */

/** 업로드 가능한 최대 PDF 용량 (바이트). 100MB */
export const MAX_PDF_FILE_SIZE_BYTES = 100 * 1024 * 1024;

/** 업로드 가능한 MIME 타입 */
export const ALLOWED_PDF_MIME_TYPES = ["application/pdf"];

/**
 * Gemini 호출 1회에 포함할 카탈로그 텍스트의 대략적인 최대 글자 수.
 * 페이지 단위로 묶되, 이 값을 넘기지 않는 선에서 여러 페이지를 하나의 청크로 합친다.
 * (모델의 안정적인 구조화 추출 품질과 비용/속도의 균형을 고려한 값)
 */
export const MAX_CHUNK_CHARS = 12000;

/**
 * 카탈로그 구조화 추출에 사용하는 Gemini 모델.
 * gemini-2.5-flash 는 신규 사용자에게 더 이상 제공되지 않아(404 NOT_FOUND),
 * Google 이 안내하는 후속 모델 gemini-3.6-flash 를 사용한다.
 */
export const CATALOG_EXTRACTION_MODEL = "gemini-3.6-flash";

/**
 * 청크 1건당 Gemini 응답에 허용할 최대 출력 토큰 수.
 * 최신 flash 모델은 기본적으로 "thinking" 토큰을 이 예산 안에서 함께 소비하므로,
 * 실제 카탈로그처럼 항목이 많은 페이지에서는 8192 로는 JSON 출력이 중간에 잘릴 수 있다.
 * (아래 thinkingConfig.thinkingBudget = 0 과 함께, 여유 있게 잡아둔다)
 */
export const CATALOG_EXTRACTION_MAX_TOKENS = 32768;

/**
 * 공식 홈페이지 동기화(크롤러) 대상 브랜드명. equipment 테이블의 brand 컬럼 값과
 * 동일해야 한다. 표준 표기(normalizeBrand.ts 기준)인 한글로 통일한다 — 예전에는
 * "SCUBAPRO"(영문 대문자)였는데, 퐁당닷컴 크롤러가 저장하는 "스쿠버프로"(한글)
 * 와 표기가 달라 같은 브랜드가 두 행으로 갈라지는 원인이었다.
 */
export const SCUBAPRO_SYNC_BRAND = "스쿠버프로";

/** 다이빙 장비 표준 카테고리 목록 (Gemini 추출 프롬프트와 동일하게 유지) */
export const EQUIPMENT_CATEGORIES = [
  "BCD",
  "레귤레이터",
  "슈트",
  "마스크",
  "스노클",
  "핀",
  "다이빙 컴퓨터",
  "웨이트 시스템",
  "부츠",
  "장갑",
  "후드",
  "다이빙 라이트",
  "게이지",
  "가방",
  "기타",
] as const;

/**
 * 카테고리별로 흔히 쓰이는 다른 표기(구어체/줄임말). 표준 카테고리명은 하나로
 * 고정하지만("레귤레이터"), 실제로 "호흡기"처럼 완전히 다른 단어로 검색하는
 * 경우가 많다 — 브랜드처럼 같은 대상의 "표기 차이"가 아니라 "동의어"라서
 * 데이터 정규화로는 해결이 안 되고, 검색 시 함께 매칭해줘야 한다.
 * (장비 추가 화면의 카테고리 Combobox 에서 option.description 으로 활용)
 */
export const CATEGORY_SYNONYMS: Partial<Record<(typeof EQUIPMENT_CATEGORIES)[number], string[]>> = {
  레귤레이터: ["호흡기"],
  BCD: ["부력조절기", "부력조끼"],
  슈트: ["웻슈트", "드라이슈트", "잠수복"],
  마스크: ["물안경"],
  핀: ["오리발"],
  "다이빙 컴퓨터": ["다이컴"],
  "웨이트 시스템": ["웨이트벨트", "납벨트"],
  "다이빙 라이트": ["수중랜턴", "다이브라이트"],
  게이지: ["압력계"],
  장갑: ["글러브"],
  가방: ["다이브백", "다이빙백"],
};
