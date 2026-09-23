import "server-only";
import axios from "axios";
import * as cheerio from "cheerio";
import type { ParsedEquipmentItem } from "@/lib/equipment/types";

const BASE_URL = "https://pongdang.com";
const LIST_PATH = "/goods/search_list";
/**
 * 크롤링 대상 최상위 카테고리 코드 목록.
 *  - c0002 ("스쿠버"): 마스크/핀/슈트/호흡기/컴퓨터 등 핵심 장비 전체.
 *  - c0003 ("스쿠버 acc"): 스냅링/오링/아답터/호스/장비걸이/세척제 등 부속품·
 *    소모품 계열. 예전에는 이 카테고리 자체를 요청하지 않아서 "호스",
 *    "부속품" 같은 카테고리 전체가 통째로 누락됐다(실측으로 확인: category=
 *    c0003 로 별도 요청해야만 응답에 잡히고, item_category 값도 "스쿠버"가
 *    아니라 "스쿠버 acc"로 따로 태그돼 있어 필터도 함께 넓혀야 했다 — 아래
 *    scubaOnly 필터 참고).
 */
const CATEGORY_CODES = ["c0002", "c0003"] as const;
const REFERER_BY_CATEGORY: Record<string, string> = {
  c0002: `${BASE_URL}/goods/catalog?code=0002`,
  c0003: `${BASE_URL}/goods/catalog?code=0003`,
};
const USER_AGENT =
  "Mozilla/5.0 (compatible; DiveEstimateCatalogSync/1.0; +internal equipment price sync)";
const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_DELAY_MS = 400;
/** 사이트가 실제로 허용하는 페이지당 최대 상품 수(실측 확인. 이보다 큰 값은 무시되고 기본값 40으로 응답). */
const PAGE_SIZE = 200;
/** 페이지네이션 안전장치(카테고리별 상한). 실측 기준 c0002 는 29페이지(5,659건),
 *  c0003 도 수천 건대라 여유 있게 잡아, 마크업/응답 변경 시 무한루프를 막는다. */
const MAX_PAGES = 60;
/** 한국 부가가치세율(10%). RawPongdangItem.price(할인 후, 부가세 제외)를 정상가로 역산할 때 필요. */
const VAT_RATE = 1.1;

/**
 * 퐁당닷컴 item_category2(사이트 자체 세부 카테고리) → 우리 장비 마스터
 * 카테고리 매핑. 실제 API 응답(5,005건, "스쿠버" 태그 기준)을 전수 조사해
 * 확인한 25개 값을 모두 반영했다.
 *
 * "스쿠버 acc"(c0003) 카테고리 추가분: 이 카테고리는 스냅링/오링/아답터처럼
 * 완제품이 아니라 부속·소모품 위주라 기존 15개 표준 카테고리(BCD, 레귤레이터
 * 등 "장비 종류")에 억지로 끼워 맞추면 오히려 검색에 방해가 된다 — 그래서
 * EQUIPMENT_CATEGORIES 에 "호스"/"부속품"/"소모품"/"악세서리" 4개를 새로
 * 추가하고, 아래처럼 실측한 item_category2 값들을 여기로 분류했다.
 */
const CATEGORY_MAP: Record<string, string> = {
  웨트슈트: "슈트",
  드라이슈트: "슈트",
  "BC 백플레이트": "BCD",
  "BC 자켓, 사이드마운트": "BCD",
  마스크: "마스크",
  스노클: "스노클",
  오리발: "핀",
  가방: "가방",
  "호흡기, 보조 호흡기": "레귤레이터",
  라이트: "다이빙 라이트",
  게이지: "게이지",
  "웨이트, 벨트, 포켓": "웨이트 시스템",
  장갑: "장갑",
  컴퓨터: "다이빙 컴퓨터",
  후드: "후드",
  부츠: "부츠",
  // 아래는 우리 카테고리 체계에 딱 맞는 값이 없어 "기타"로 수렴시킨다.
  "카메라 하우징": "기타",
  "공기통, 밸브": "기타",
  나이프: "기타",
  어패럴: "기타",
  "통신, 탐색 장비": "기타",
  컴프레서: "기타",
  "액션 카메라, 하우징": "기타",
  "스쿠터, 재호흡기": "기타",
  // ── c0003("스쿠버 acc") 세부 카테고리 ────────────────────────────────
  호스: "호스",
  스냅링: "부속품",
  "장비걸이": "부속품",
  마우스피스: "부속품",
  "소세지, 부이": "부속품",
  다이브릴: "부속품",
  "다이빙 공구": "부속품",
  아답터: "부속품",
  "에어노즐, 버블건": "부속품",
  "인플레이터, 덤프밸브": "부속품",
  "호흡기 부품": "부속품",
  "얼러트, 탐침봉, 후사경": "부속품",
  "유지 보수, 세척제": "소모품",
  "오링, 오링핀": "소모품",
  "다이빙 굿즈": "악세서리",
  피규어: "악세서리",
  "로그북, 교재": "기타",
  "CPR, 응급키트": "기타",
  상어퇴치기: "기타",
  초특가: "기타",
};
const DEFAULT_CATEGORY = "기타";

/**
 * 지금까지 "스쿠버" 하나만 정상 카테고리로 인정했는데, c0003 카테고리 상품은
 * 사이트가 item_category 값 자체를 "스쿠버 acc"로 따로 태그해 내려준다
 * (item_category2 는 스냅링/호스 등 세부값이 맞는데도, 이 상위 태그 하나
 * 때문에 예전 필터에서는 전부 걸러졌다). "프리다이빙"/"수영, 물놀이"/
 * "초특가" 등 다른 상위 태그는 기존과 동일하게 계속 제외한다(교차 태그된
 * 수영/캠핑/프리다이빙 상품을 걸러내는 기존 스코프를 그대로 유지).
 */
const INCLUDED_TOP_CATEGORIES = new Set(["스쿠버", "스쿠버 acc"]);

interface RawPongdangItem {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_category: string;
  item_category2: string;
  /** 할인 적용 후 실판매가, 부가세 제외 금액(GA4 트래킹용 값). 화면에 보이는 가격이 아니다. */
  price: number;
  /** 정상가와 실판매가(부가세 포함)의 차액, 원화. 할인이 없으면 0. */
  discount: number;
  /**
   * 옵션(색상/사이즈 등) 표기 — 같은 상품이 옵션별로 여러 행으로 내려올 때
   * 행마다 다른 값을 가진다. 자유 형식 텍스트라 형태가 매우 다양하다(실측
   * 예: "블랙", "XS", "블루/M(230-250)", "220-230(3XS)", "블랙.그레이",
   * "[재입고 미정] XS"). parseVariantOptions()로 색상/사이즈를 최선의
   * 노력으로 분리한다 — 모든 표기를 완벽히 분류할 수는 없지만(예:
   * "요크타입 MK25 EVO/S600"처럼 옵션이 아니라 사실상 모델명인 경우),
   * 지금까지는 이 필드 자체를 전혀 읽지 않아 색상/사이즈가 100% 누락되고
   * 있었으므로 부분적 추출도 이전보다 확실한 개선이다.
   */
  item_variant: string;
}

export interface PongdangEquipmentItem extends ParsedEquipmentItem {
  brand: string;
}

export interface PongdangCrawlResult {
  items: PongdangEquipmentItem[];
  warnings: string[];
  pagesFetched: number;
  distinctBrandCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSearchListPage(pageNo: number, categoryCode: string): Promise<string> {
  const response = await axios.get<string>(`${BASE_URL}${LIST_PATH}`, {
    params: {
      category: categoryCode,
      searchMode: "catalog",
      page: pageNo,
      per: PAGE_SIZE,
    },
    headers: {
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Referer: REFERER_BY_CATEGORY[categoryCode] ?? REFERER_BY_CATEGORY["c0002"],
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    timeout: REQUEST_TIMEOUT_MS,
    responseType: "text",
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.data;
}

/**
 * 퐁당닷컴은 상품 목록을 이 AJAX 응답 조각 안에 GA4 전자상거래 트래킹용
 * JSON 배열(`var items = '[...]';`)로 함께 내려준다. 브랜드/카테고리/가격이
 * 이미 정형화되어 있어 그대로 파싱한다(price 는 정수 KRW).
 *
 * 배열은 JS 작은따옴표 문자열로 감싸져 있어, 상품명에 작은따옴표가 들어간
 * 경우 `\'` 로 이스케이프되어 있다. 이스케이프를 인식하는 정규식으로 문자열
 * 경계를 정확히 찾은 뒤 `\'` 를 되돌려서 JSON.parse 한다.
 */
function extractRawItems(html: string): RawPongdangItem[] {
  const match = html.match(/var items = '((?:\\.|[^'\\])*)'/);
  if (!match) return [];

  const jsonText = match[1].replace(/\\'/g, "'");

  try {
    const parsed = JSON.parse(jsonText);
    return Array.isArray(parsed) ? (parsed as RawPongdangItem[]) : [];
  } catch {
    return [];
  }
}

function mapCategory(rawCategory2: string): string {
  return CATEGORY_MAP[rawCategory2.trim()] ?? DEFAULT_CATEGORY;
}

/** "109,000원" / "₩109,000" / " 109,000 " 등에서 숫자만 뽑아 정수로 정제한다. */
function parsePriceNumber(text: string | undefined | null): number {
  if (!text) return NaN;
  const digitsOnly = text.replace(/[^0-9]/g, "");
  if (!digitsOnly) return NaN;
  return Number(digitsOnly);
}

// ── 옵션(item_variant) → 색상/사이즈 분리 ────────────────────────────────────
// 실측으로 확인한 item_variant 표기(400여 건 샘플)는 단일 값도, 여러 값이
// "/", "~", ".", "," 로 구분돼 섞인 경우도 있다(예: "블루/M(230-250)",
// "블랙.그레이", "XS~S"). 완벽한 분류기는 아니고("요크타입 MK25 EVO/S600"
// 처럼 옵션이 아니라 모델 스펙인 경우는 걸러내지 못하고 버려진다), 다만
// 지금까지는 이 필드를 전혀 안 읽어 색상/사이즈가 항상 빈 배열이었으므로,
// 아래 규칙으로 "최선의 노력"만큼만 분리해도 이전보다 명백한 개선이다.
const COLOR_ROOTS = [
  // 한글 (복합어에도 걸리도록 부분 문자열 매칭 — "다크 그린", "로즈핑크",
  // "카모화이트옐로우"처럼 색상 단어 앞뒤에 수식어가 붙는 경우가 많다)
  "블랙", "화이트", "흰색", "검정", "블루", "파랑", "레드", "빨강",
  "옐로우", "노랑", "그린", "초록", "연두", "그레이", "회색", "퍼플",
  "보라", "핑크", "오렌지", "주황", "네이비", "골드", "실버", "베이지",
  "브라운", "카키", "민트", "아이보리", "형광",
  // 영문(가끔 그대로 노출되는 경우)
  "black", "white", "blue", "red", "yellow", "green", "gray", "grey",
  "purple", "pink", "orange", "navy", "gold", "silver", "beige",
  "brown", "khaki", "mint", "ivory",
];

// 의류/신발 사이즈 표기. 아래 네 형태를 전부 커버한다:
//   1) 옷 사이즈 단독: S, M, L, XS, XXL, 2XL, 3XS ...
//   2) 신발/웻슈트 치수: 220, 220-230, 22cm ...
//   3) "치수(옷사이즈코드)": 220-230(3XS), 230-240(XXS)
//   4) "옷사이즈코드(치수)": XXS(230)
const CLOTHING_SIZE = /^\d?x{0,3}[sml]$/i;
// 치수 하나: 2~3자리 정수(+선택적 소수 .5 등), 범위는 "-"/"~" 둘 다 실측됨
// (예: "220-230" 과 "230~235" 가 같은 뜻으로 혼용된다), 단위 cm/mm 는 선택.
const NUMERIC = /\d{2,3}(\.\d+)?/;
const NUMERIC_SIZE = new RegExp(`^${NUMERIC.source}([-~]${NUMERIC.source})?\\s*(cm|mm)?$`, "i");
const NUMERIC_THEN_CODE = new RegExp(
  `^${NUMERIC.source}([-~]${NUMERIC.source})?\\s*(cm|mm)?\\s*\\(\\s*\\d?x{0,3}[sml]\\s*\\)$`,
  "i"
);
const CODE_THEN_NUMERIC = new RegExp(
  `^\\d?x{0,3}[sml]\\s*\\(\\s*${NUMERIC.source}([-~]${NUMERIC.source})?\\s*(cm|mm)?\\s*\\)$`,
  "i"
);

/** 세그먼트 맨 앞의 "[재입고 미정]" 류 대괄호 주석을 떼어낸다. */
function stripBracketNote(segment: string): string {
  return segment.replace(/^\[[^\]]*\]\s*/, "").trim();
}

/**
 * "남성 XS", "여자 S" 처럼 사이즈 코드 앞에 성별/구분 단어가 공백으로 붙어
 * 있으면 사이즈 정규식이 매칭에 실패한다("남성/S"처럼 "/"로 이미 분리된
 * 경우는 문제없음). 사이즈 판별 직전에만 이 접두어를 떼어내고 판별한다
 * (색상 판별에는 영향 없음 — 원래 세그먼트로 그대로 시도한다).
 */
function stripGenderPrefix(segment: string): string {
  return segment.replace(/^(남성|여성|남자|여자|성인|아동|유아|공용)\s+/, "").trim();
}

type VariantClass = "color" | "size" | null;

function classifyVariantSegment(rawSegment: string): VariantClass {
  const segment = stripBracketNote(rawSegment);
  if (!segment) return null;

  const sizeCandidate = stripGenderPrefix(segment);
  if (
    CLOTHING_SIZE.test(sizeCandidate) ||
    NUMERIC_SIZE.test(sizeCandidate) ||
    NUMERIC_THEN_CODE.test(sizeCandidate) ||
    CODE_THEN_NUMERIC.test(sizeCandidate)
  ) {
    return "size";
  }

  const lower = segment.toLowerCase();
  if (COLOR_ROOTS.some((root) => lower.includes(root.toLowerCase()))) {
    return "color";
  }

  return null;
}

/**
 * "/", "~", ".", "," 를 구분자로 세그먼트를 나누되, 괄호 안에서는 절대
 * 나누지 않는다. 괄호 밖의 "~"/"," 는 "여러 옵션을 나열"하는 뜻이지만
 * (예: "XS~S" = XS 와 S 둘 다 옵션), 괄호 안의 "~"/"." 는 숫자 범위 표기의
 * 일부다(예: "M(230~235)", "XS(55.5~56cm)") — 이걸 구분 없이 그냥
 * split(/[/~.,]/) 로 나누면 "M(230" 과 "235)" 로 쪼개져 두 조각 다 사이즈
 * 정규식에 안 걸리고 통째로 버려진다(실측으로 발견한 버그).
 */
function splitVariantSegments(variant: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (const ch of variant) {
    if (ch === "(" || ch === "（") depth += 1;
    if (ch === ")" || ch === "）") depth = Math.max(0, depth - 1);

    if (depth === 0 && /[/~.,]/.test(ch)) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);

  return parts.map((s) => s.trim()).filter(Boolean);
}

interface ParsedVariant {
  colors: string[];
  sizes: string[];
  /** 색상/사이즈 어느 쪽에도 매칭되지 않아 버려진 세그먼트 수(가시성용 집계). */
  unclassifiedCount: number;
}

/** item_variant 원문 하나를 색상/사이즈 세그먼트로 분리한다. */
function parseVariantSegments(variant: string): ParsedVariant {
  const colors: string[] = [];
  const sizes: string[] = [];
  let unclassifiedCount = 0;

  const segments = splitVariantSegments(variant);

  for (const segment of segments) {
    const cls = classifyVariantSegment(segment);
    const cleaned = stripBracketNote(segment);
    if (cls === "size") sizes.push(cleaned);
    else if (cls === "color") colors.push(cleaned);
    else unclassifiedCount += 1;
  }

  return { colors, sizes, unclassifiedCount };
}

interface DomPriceEntry {
  /** 취소선(정가) 태그(`class="consumer_price"`)가 있으면 그 값. 없으면 null. */
  consumerPrice: number | null;
  /** 현재 노출 중인(할인 여부 무관) 판매가(`class="sale_price"`). */
  salePrice: number | null;
}

/**
 * 상품 목록 HTML에서 goods_id(=`item_id`) 별 가격 정보를 추출한다.
 *
 * [절대 규칙] 취소선이 그어진 정상가(`.consumer_price`)와 강조된 실판매가
 * (`.sale_price`)가 함께 있으면, 아무리 실판매가가 크고 굵게 강조돼 있어도
 * 무조건 `.consumer_price`(취소선 안의 더 높은 금액)만 정상 소비자가로
 * 채택한다. `.consumer_price` 태그 자체가 없는(할인이 전혀 없는) 상품만
 * `.sale_price`를 정상가로 인정한다 — 이 if/else 우선순위를 절대 뒤집지 않는다.
 *
 * (참고: 이 사이트는 `<del>`/`<strike>`/`text-decoration:line-through` 대신
 * 시맨틱 클래스명 `class="consumer_price"`/`class="sale_price"`로 정가·할인가를
 * 구분해서 렌더링한다 — 실측으로 확인한 실제 마크업.)
 */
function extractDomPrices(html: string): Map<string, DomPriceEntry> {
  const $ = cheerio.load(html);
  const priceByGoodsId = new Map<string, DomPriceEntry>();

  $("li.goods_list_style1").each((_, el) => {
    const $item = $(el);
    const href = $item.find('a[href*="/goods/view?no="]').first().attr("href") ?? "";
    const goodsId = href.match(/no=(\d+)/)?.[1];
    if (!goodsId) return;

    const priceArea = $item.find(".goods_price_area").first();

    // 조건 1(최우선): 취소선 정상가 태그가 존재하는지 먼저 검사.
    const consumerText = priceArea.find(".consumer_price .num").first().text();
    const consumerPriceRaw = parsePriceNumber(consumerText);
    const consumerPrice = Number.isFinite(consumerPriceRaw) ? consumerPriceRaw : null;

    // 조건 2: 취소선 태그가 없을 때만 쓰는 유일한 노출 가격.
    const saleText = priceArea.find(".sale_price .num").first().text();
    const salePriceRaw = parsePriceNumber(saleText);
    const salePrice = Number.isFinite(salePriceRaw) ? salePriceRaw : null;

    priceByGoodsId.set(goodsId, { consumerPrice, salePrice });
  });

  return priceByGoodsId;
}

/**
 * 상품 1건의 최종 정상 소비자가를 결정한다. DOM에서 뽑은 가격을 최우선으로
 * 쓰고, 어떤 이유로든 DOM에서 가격을 못 찾은 경우에만(사이트 마크업이
 * 예기치 않게 바뀐 경우 등) GA4 트래킹 값을 이용한 역산식으로 안전망을 둔다
 * — "1건도 누락하지 않는다"는 요구를 만족시키기 위한 이중 방어선이다.
 */
function resolveRegularPrice(
  raw: RawPongdangItem,
  domPrice: DomPriceEntry | undefined
): { price: number; usedFallback: boolean } {
  if (domPrice) {
    // 조건 1(할인 상품): 취소선 정상가가 있으면 그것만 쓴다. 실판매가는 무시.
    if (domPrice.consumerPrice !== null && domPrice.consumerPrice > 0) {
      return { price: domPrice.consumerPrice, usedFallback: false };
    }
    // 조건 2(무할인 상품): 취소선 태그 자체가 없을 때만 노출가를 정상가로 인정.
    if (domPrice.salePrice !== null && domPrice.salePrice > 0) {
      return { price: domPrice.salePrice, usedFallback: false };
    }
  }

  // 안전망: DOM 파싱에 실패했을 때만 GA4 트래킹 값(discount 포함)으로 역산.
  const rawPrice = Number(raw.price);
  const discount = Number.isFinite(Number(raw.discount)) ? Number(raw.discount) : 0;
  if (!Number.isFinite(rawPrice)) return { price: NaN, usedFallback: true };
  return { price: Math.round(rawPrice * VAT_RATE) + discount, usedFallback: true };
}

/**
 * 퐁당닷컴(pongdang.com) "스쿠버" 카테고리 트리 전체를 순회하며
 * [브랜드, 카테고리, 모델명, 정상 소비자가격(할인 전)]을 수집한다.
 *
 * 가격 결정 알고리즘(절대 규칙, 예외 없음):
 *   1순위 — 목록 HTML에 취소선 정상가 태그(`.consumer_price`)가 있으면
 *           그 값만 쓴다. 바로 위에 크고 굵게 강조된 실판매가(`.sale_price`)가
 *           있어도 완전히 무시한다.
 *   2순위 — `.consumer_price` 태그 자체가 없는(할인이 아예 없는) 상품만
 *           `.sale_price`(유일한 노출가)를 정상가로 인정한다.
 *   안전망 — 위 두 조건 모두 DOM에서 값을 못 찾은 극히 예외적인 경우에만
 *           GA4 트래킹 JSON(price+discount)으로 역산해 1건도 누락시키지 않는다.
 *
 * 브랜드/모델명/카테고리는 사이트가 내려주는 GA4 트래킹 JSON을 그대로 쓴다
 * (이미 정형화되어 있고 실측 검증됨). AI 파싱은 쓰지 않는다 — 이 크롤러의
 * 실패 원인은 "파싱이 어려워서"가 아니라 "어떤 필드를 신뢰할지"의 문제였고,
 * LLM은 그 판단을 더 잘 해주지 않을뿐더러 금액 자릿수 환각 위험만 더한다.
 * (직접 검증: GA4 JSON 의 discount 필드가 실제 화면 표시와 불일치하는 상품이
 * 전체의 약 13%나 있었음 — 그래서 DOM의 `.consumer_price`/`.sale_price` 를
 * 최우선 소스로 바꿨다.)
 */
export async function crawlPongdangCatalog(): Promise<PongdangCrawlResult> {
  const warnings: string[] = [];
  const rawItems: RawPongdangItem[] = [];
  const domPriceByGoodsId = new Map<string, DomPriceEntry>();
  let pagesFetched = 0;

  for (const categoryCode of CATEGORY_CODES) {
    let categoryPagesFetched = 0;

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      let html: string;
      try {
        html = await fetchSearchListPage(page, categoryCode);
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        warnings.push(`[${categoryCode}] ${page}페이지 요청 실패: ${message}`);
        break;
      }

      pagesFetched += 1;
      categoryPagesFetched += 1;
      const pageItems = extractRawItems(html);

      if (pageItems.length === 0) break;

      rawItems.push(...pageItems);
      // 같은 HTML 응답 안에서 가격은 DOM(.consumer_price/.sale_price)으로 별도 추출한다.
      for (const [goodsId, entry] of extractDomPrices(html)) {
        domPriceByGoodsId.set(goodsId, entry);
      }

      if (pageItems.length < PAGE_SIZE) break;

      await sleep(REQUEST_DELAY_MS);
    }

    if (categoryPagesFetched === 0) {
      warnings.push(`[${categoryCode}] 응답이 없어 이 카테고리는 건너뛰었습니다.`);
    }
  }

  // "스쿠버"/"스쿠버 acc" 로 정확히 태깅된 상품만 남긴다.
  // (수영/물놀이, 캠핑, 프리다이빙 등으로 교차 태그된 상품은 제외)
  const scubaOnly = rawItems.filter((item) => INCLUDED_TOP_CATEGORIES.has(item.item_category));

  // 같은 상품이 색상/사이즈 등 옵션(item_variant)별로 여러 행으로 내려오므로
  // (브랜드, 모델명) 기준으로 합치고, 대표 가격은 옵션 중 최저가로 둔다.
  // 색상/사이즈는 그 상품의 모든 옵션 행에서 parseVariantSegments 로 뽑아낸
  // 값을 Set 으로 누적한다(중복 제거, 끝에서 한글 기준으로 정렬).
  interface MergedAccumulator extends PongdangEquipmentItem {
    colorSet: Set<string>;
    sizeSet: Set<string>;
  }
  const merged = new Map<string, MergedAccumulator>();
  const skippedNoPriceNames: string[] = [];
  let fallbackUsedCount = 0;
  let unclassifiedVariantSegments = 0;

  for (const raw of scubaOnly) {
    const brand = raw.item_brand?.trim();
    const name = raw.item_name?.trim();
    const domPrice = domPriceByGoodsId.get(raw.item_id);
    const { price, usedFallback } = resolveRegularPrice(raw, domPrice);

    if (!brand || !name || !Number.isFinite(price) || price <= 0) {
      // "가격문의" 등 원천적으로 가격 정보가 없는 상품만 여기서 걸러진다.
      // 조용히 누락시키지 않고 이름을 남겨, 몇 건이 왜 빠졌는지 항상 확인할 수 있게 한다.
      if (name) skippedNoPriceNames.push(name);
      continue;
    }

    if (usedFallback) fallbackUsedCount += 1;

    const key = `${brand}\u0000${name}`;
    const existing = merged.get(key);
    const { colors, sizes, unclassifiedCount } = parseVariantSegments(raw.item_variant ?? "");
    unclassifiedVariantSegments += unclassifiedCount;

    if (existing) {
      // 더 싼 옵션(변형)이 나오면 대표 가격을 갱신한다.
      if (price < existing.price_retail) {
        existing.price_retail = price;
      }
      colors.forEach((c) => existing.colorSet.add(c));
      sizes.forEach((s) => existing.sizeSet.add(s));
      continue;
    }

    merged.set(key, {
      brand,
      category: mapCategory(raw.item_category2 ?? ""),
      name,
      price_retail: price,
      colors: [],
      sizes: [],
      colorSet: new Set(colors),
      sizeSet: new Set(sizes),
    });
  }

  if (fallbackUsedCount > 0) {
    warnings.push(
      `${fallbackUsedCount}건은 목록 페이지에서 가격 요소(.sale_price/.consumer_price)를 찾지 못해 예비 계산식으로 대체했습니다. 사이트 마크업이 바뀌었을 수 있습니다.`
    );
  }

  if (skippedNoPriceNames.length > 0) {
    const sample = skippedNoPriceNames.slice(0, 5).join(", ");
    warnings.push(
      `가격 정보가 없어(가격문의 등) 제외된 상품 ${skippedNoPriceNames.length}건. 예: ${sample}`
    );
  }

  if (unclassifiedVariantSegments > 0) {
    warnings.push(
      `옵션 표기 ${unclassifiedVariantSegments}건은 색상/사이즈로 분류하지 못해 제외했습니다(예: 모델 스펙 표기가 옵션칸에 함께 내려오는 경우).`
    );
  }

  const items: PongdangEquipmentItem[] = Array.from(merged.values()).map((acc) => ({
    brand: acc.brand,
    category: acc.category,
    name: acc.name,
    price_retail: acc.price_retail,
    colors: Array.from(acc.colorSet).sort((a, b) => a.localeCompare(b, "ko")),
    sizes: Array.from(acc.sizeSet).sort((a, b) => a.localeCompare(b, "ko")),
  }));
  const distinctBrandCount = new Set(items.map((item) => item.brand)).size;

  return { items, warnings, pagesFetched, distinctBrandCount };
}

// ── 브랜드별 할인율(%) 수집 ───────────────────────────────────────────────────

export interface BrandDiscountRateSummary {
  brand: string;
  ratePercent: number;
  sampleCount: number;
}

export interface PongdangDiscountRateCrawlResult {
  brandRates: BrandDiscountRateSummary[];
  warnings: string[];
  pagesFetched: number;
}

/**
 * 퐁당닷컴 상품 목록에 빨간/주황색 배지로 그대로 노출되는 할인율 숫자
 * (`<span class="discount_rate"><b class="num">30</b>%</span>`)를 화면에
 * 보이는 그대로 읽어 브랜드별 평균을 낸다. 가격을 역산하지 않는 가장 단순한
 * 방식 — 로그인 없이 누구나 보는 공개 데이터라 별도 인증도 필요 없다.
 * 할인 배지가 아예 없는(정가) 상품은 0%로 안전하게 처리한다.
 */
export async function crawlPongdangBrandDiscountRates(): Promise<PongdangDiscountRateCrawlResult> {
  const warnings: string[] = [];
  const brandRateSamples = new Map<string, number[]>();
  let pagesFetched = 0;

  for (const categoryCode of CATEGORY_CODES) {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      let html: string;
      try {
        html = await fetchSearchListPage(page, categoryCode);
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        warnings.push(`[${categoryCode}] ${page}페이지 요청 실패: ${message}`);
        break;
      }

      pagesFetched += 1;
      const $ = cheerio.load(html);
      const productBlocks = $("li.goods_list_style1");
      if (productBlocks.length === 0) break;

      productBlocks.each((_, el) => {
        const $item = $(el);
        const brand = $item.find(".goods_name_area .brand_name").first().text().trim();
        if (!brand) return;

        // 할인율 배지 숫자만 그대로 추출. 배지 자체가 없으면(정가 상품) 0%.
        const rateText = $item.find(".goods_price_area .discount_rate .num").first().text();
        const digitsOnly = rateText.replace(/[^0-9]/g, "");
        const rate = digitsOnly ? Number(digitsOnly) : 0;
        if (!Number.isFinite(rate) || rate < 0 || rate > 100) return;

        const samples = brandRateSamples.get(brand) ?? [];
        samples.push(rate);
        brandRateSamples.set(brand, samples);
      });

      if (productBlocks.length < PAGE_SIZE) break;
      await sleep(REQUEST_DELAY_MS);
    }
  }

  const brandRates: BrandDiscountRateSummary[] = Array.from(brandRateSamples.entries()).map(
    ([brand, samples]) => ({
      brand,
      ratePercent: Math.round((samples.reduce((s, r) => s + r, 0) / samples.length) * 10) / 10,
      sampleCount: samples.length,
    })
  );

  return { brandRates, warnings, pagesFetched };
}
