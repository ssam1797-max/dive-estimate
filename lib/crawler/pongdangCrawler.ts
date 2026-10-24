import "server-only";
import axios from "axios";
import * as cheerio from "cheerio";
import type { ParsedEquipmentItem } from "@/lib/equipment/types";
import type { PongdangCategoryCode } from "@/lib/equipment/pongdangCategories";

const BASE_URL = "https://pongdang.com";
const LIST_PATH = "/goods/search_list";
const LOGIN_PAGE_PATH = "/member/login";
const LOGIN_PROCESS_PATH = "/login_process/login";
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

/**
 * 동기화 대상에서 제외할 키워드. 상품명/상위·세부 카테고리 중 하나라도
 * 포함되면 제외한다.
 *  - "이벤트"/"초특가"/"땡처리"/"DP 상품": "★옥토 증정 이벤트★ MK25 EVO/S600",
 *    "★초특가★ 코팅납 1kg", "땡처리 핀 떨이", "★매장 DP 상품★ 제트핀 블랙"
 *    처럼 사은품 증정·재고 떨이·매장 전시(디피) 특가 프로모션용으로 올라온
 *    행이라, 같은 상품의 정상 행과 중복되거나 프로모션 한정 가격이 정상가로
 *    잘못 반영된다. "DP"만으로 거르면 "DPV 스쿠터"(DPV)나 압력게이지 모델명
 *    "DP0405-1" 같은 무관한 상품까지 걸려 "DP 상품"(공백 포함)으로 좁혀
 *    매칭한다.
 *  - "아미노바이탈"/"캠핑": 각각 영양제(c0018), 캠핑용품(c0016) 전용
 *    최상위 카테고리라 INCLUDED_TOP_CATEGORIES 필터에서 이미 걸러지지만,
 *    혹시 모를 교차 태깅에 대비한 방어적 필터로 함께 등록한다.
 */
const EXCLUDED_KEYWORDS = ["이벤트", "초특가", "땡처리", "DP 상품", "아미노바이탈", "캠핑"];

function isExcludedItem(item: RawPongdangItem): boolean {
  const haystack = [item.item_name, item.item_category, item.item_category2].join(" ");
  return EXCLUDED_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

/**
 * "[재입고 미정]"은 사이즈/컬러별 재입고 시점조차 안내되지 않는 품절 표시다.
 * 단일 옵션 상품은 item_name 에("[재입고 미정] 크레씨 호흡기 가방"), 다중
 * 옵션 상품은 품절된 옵션 행의 item_variant 에만 붙는다("노랑/[재입고
 * 미정] XS" — 같은 상품의 다른 사이즈 행은 멀쩡히 구매 가능할 수 있다).
 * 그래서 상품 전체가 아니라 이 행 하나만 걸러낸다 — 다중 옵션 상품이면
 * 나머지 구매 가능한 옵션은 그대로 남고, 모든 옵션이 품절이면 결과적으로
 * 상품 전체가 빠진다. "[9월 중순 재입고 예정]"처럼 재입고 시점이 예고된
 * 경우는 곧 다시 살 수 있으니 제외 대상이 아니다 — 정확히 "재입고 미정"
 * 문자열만 매칭한다.
 *
 * 실측 결과 "재입고 미정"(공백 있음)과 "재입고미정"(공백 없음) 표기가
 * 섞여 있어(예: "[재입고미정] DNA (Divesoft Nitrox Analyzer)"), 공백을
 * 제거한 문자열끼리 비교해 두 표기를 모두 잡아낸다.
 */
const OUT_OF_STOCK_INDEFINITELY_MARK_NO_SPACE = "재입고미정";

function isOutOfStockIndefinitely(item: RawPongdangItem): boolean {
  const haystack = `${item.item_name ?? ""} ${item.item_variant ?? ""}`.replace(/\s+/g, "");
  return haystack.includes(OUT_OF_STOCK_INDEFINITELY_MARK_NO_SPACE);
}

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
  /** 퐁당닷컴 샵 계정 로그인 상태로 수집했을 때만 채워지는 실제 샵가(INSTRUCTOR 등급).
   *  로그인에 실패/미설정이면 이번 동기화에서는 null(기존에 저장된 값은 보존됨 —
   *  equipment-repo.ts upsertEquipmentMultiBrand 가 null이면 덮어쓰지 않음). */
  price_instructor: number | null;
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

/** Set-Cookie 응답 헤더 배열을 기존 쿠키 문자열에 병합한다(같은 이름은 최신 값으로 덮어씀). */
function mergeSetCookie(existingCookie: string, setCookieHeaders: string[] | undefined): string {
  const jar = new Map<string, string>(
    existingCookie
      .split("; ")
      .filter(Boolean)
      .map((kv) => {
        const idx = kv.indexOf("=");
        return [kv.slice(0, idx), kv.slice(idx + 1)] as [string, string];
      })
  );
  for (const raw of setCookieHeaders ?? []) {
    const kv = raw.split(";")[0];
    const idx = kv.indexOf("=");
    if (idx === -1) continue;
    jar.set(kv.slice(0, idx), kv.slice(idx + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

/**
 * 퐁당닷컴 샵(도매) 계정으로 서버가 직접 로그인해 세션 쿠키를 받아온다.
 * 매 동기화 조각(chunk) 호출마다 새로 로그인한다(쿠키를 수동 복사/보관하지
 * 않음 — 세션 만료 걱정이 없다). 실측 기준 로그인 자체는 1초 미만이라
 * 조각 1번의 시간 예산(Netlify 비배경 함수 ~30초 한도)에 미치는 영향은
 * 무시할 수 있다.
 *
 * PONGDANG_SHOP_USERID/PASSWORD 가 설정되지 않았거나 로그인에 실패하면
 * null을 반환한다 — 호출부는 이 경우 비로그인(익명) 크롤링으로 조용히
 * 폴백해, 샵가 수집만 건너뛰고 색상/사이즈/소비자가 동기화는 평소대로
 * 계속되게 한다(resolveRegularPrice 는 로그인 여부와 무관하게 동일한
 * consumer_price 를 뽑으므로 안전).
 */
/**
 * 로그인 전용 타임아웃. 조각 1번의 실질적 30초 한도(위 MAX_DETAIL_FETCHES_PER_CHUNK
 * 주석 참고) 안에서 로그인 GET+POST 두 요청이 차지할 수 있는 몫을 좁게
 * 제한한다 — REQUEST_TIMEOUT_MS(15초)를 그대로 쓰면 둘 다 타임아웃될 경우
 * 그것만으로 30초를 다 써버려 뒤에 오는 목록 페이지 수집까지 끊길 위험이
 * 있다(운영 환경에서 실측: 조각 1번이 30~31초까지 늘어나는 것을 확인).
 */
const LOGIN_TIMEOUT_MS = 6000;

interface ShopLoginResult {
  cookie: string | null;
  /** 실패 사유(성공이면 null). Netlify의 "Next.js Server Handler" 통합
   *  함수는 console.log/error 가 대시보드 Functions 로그에 전혀 찍히지
   *  않는 제약이 실측으로 확인돼, 호출부가 이 값을 그대로 동기화 결과
   *  warnings 에 노출해 API 응답만으로 원인을 바로 알 수 있게 한다
   *  (crawlPongdangCategoryChunk 참고). */
  failReason: string | null;
}

async function fetchShopSessionCookie(): Promise<ShopLoginResult> {
  const userid = process.env.PONGDANG_SHOP_USERID;
  const password = process.env.PONGDANG_SHOP_PASSWORD;
  if (!userid || !password) {
    return { cookie: null, failReason: "PONGDANG_SHOP_USERID 또는 PONGDANG_SHOP_PASSWORD 환경변수가 설정되지 않음" };
  }

  try {
    const loginPageRes = await axios.get<string>(`${BASE_URL}${LOGIN_PAGE_PATH}`, {
      headers: { "User-Agent": USER_AGENT },
      timeout: LOGIN_TIMEOUT_MS,
      responseType: "text",
      validateStatus: () => true,
    });
    if (loginPageRes.status !== 200) {
      return { cookie: null, failReason: `로그인 페이지 요청 실패: HTTP ${loginPageRes.status}` };
    }
    let cookie = mergeSetCookie("", loginPageRes.headers["set-cookie"]);

    const orderAuth = loginPageRes.data.match(/name=["']order_auth["']\s+value=["']([^"']*)["']/)?.[1] ?? "0";
    const returnUrl = loginPageRes.data.match(/name=["']return_url["']\s+value=["']([^"']*)["']/)?.[1] ?? "";

    const params = new URLSearchParams();
    params.set("return_url", returnUrl);
    params.set("order_auth", orderAuth);
    params.set("userid", userid);
    params.set("password", password);

    const loginRes = await axios.post<string>(`${BASE_URL}${LOGIN_PROCESS_PATH}`, params.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: cookie,
        Referer: `${BASE_URL}${LOGIN_PAGE_PATH}`,
      },
      timeout: LOGIN_TIMEOUT_MS,
      maxRedirects: 0,
      responseType: "text",
      validateStatus: () => true,
    });
    cookie = mergeSetCookie(cookie, loginRes.headers["set-cookie"]);

    // 로그인 실패 시 에러 alert 스크립트를 돌려준다(HTTP 상태는 200). 성공
    // 시에는 location.replace('/') 류의 리다이렉트 스크립트가 온다 — 정확한
    // 성공 문구에 의존하지 않고, 실패를 나타내는 openDialogAlert 호출이
    // 없으면 성공으로 간주한다.
    if (typeof loginRes.data === "string" && loginRes.data.includes("openDialogAlert")) {
      const alertMatch = loginRes.data.match(/openDialogAlert\('([^']*)'/);
      return {
        cookie: null,
        failReason: `로그인 거부됨(status ${loginRes.status}): ${alertMatch?.[1] ?? "(메시지 없음)"}`,
      };
    }
    return { cookie, failReason: null };
  } catch (error) {
    const detail =
      error instanceof Error
        ? `${error.name}: ${error.message}${"code" in error ? ` (code=${(error as { code?: string }).code})` : ""}`
        : String(error);
    return { cookie: null, failReason: `로그인 요청 중 예외: ${detail}` };
  }
}

async function fetchSearchListPage(
  pageNo: number,
  categoryCode: string,
  shopCookie: string | null
): Promise<string> {
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
      ...(shopCookie ? { Cookie: shopCookie } : {}),
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
  /** 상품 썸네일 이미지의 절대 URL(`.item_img_area img[src]`). 못 찾으면 null. */
  imageUrl: string | null;
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
const PONGDANG_IMAGE_BASE = "https://www.pongdang.com";

/**
 * 레이지 로딩 라이브러리가 흔히 넣어두는 "아직 실제 이미지가 아닌" src 값을
 * 가려낸다(1x1 투명 gif, 로딩 스피너, 사이트 자체 "이미지 없음" 플레이스홀더
 * 등). 이런 src 가 걸리면 `data-src`/`data-original` 속성의 실제 URL을
 * 대신 써야 한다 — axios 로 받은 정적 HTML은 레이지 로딩 JS가 실행되기 전
 * 상태라, 진짜 주소가 src 가 아니라 이 data-* 속성에만 들어있는 경우가 있다.
 */
function isPlaceholderImageSrc(src: string): boolean {
  const trimmed = src.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  return (
    lower.includes("noimage") ||
    lower.includes("no_image") ||
    lower.includes("blank.gif") ||
    lower.includes("loading") ||
    lower.includes("spacer.gif") ||
    lower.includes("placeholder") ||
    lower.includes("lazy")
  );
}

/**
 * 크롤링으로 수집한 이미지 주소를 항상 브라우저에서 바로 쓸 수 있는 완전한
 * https 절대 URL로 정규화한다.
 *  - "/"로 시작하는 사이트 루트 상대 경로 → PONGDANG_IMAGE_BASE 를 붙인다.
 *  - "//"로 시작하는 프로토콜 상대 경로 → "https:"를 붙인다.
 *  - "http://" 로 시작 → Mixed Content(안전하지 않은 콘텐츠) 경고/차단을
 *    피하기 위해 "https://"로 치환한다.
 *  - 이미 "https://" 면 그대로 쓴다.
 */
function normalizeImageUrl(rawUrl: string | undefined | null): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${PONGDANG_IMAGE_BASE}${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;

  // 위 어느 형태도 아닌 드문 경우(프로토콜 없는 상대 경로 등) — 베이스에
  // 안전하게 슬래시 하나만 끼워 붙인다.
  return `${PONGDANG_IMAGE_BASE}/${trimmed.replace(/^\.?\/*/, "")}`;
}

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

    // 썸네일: `.item_img_area` 안 첫 <img>. src 가 비어있거나 레이지 로딩
    // 플레이스홀더(사이트 자체 "이미지 없음" gif 등)면 data-src/data-original
    // 에 들어있는 실제 주소를 대신 쓴다(레이지 로딩 라이브러리가 흔히 쓰는
    // 패턴 — 정적 HTML만 받아오는 axios 크롤링이라 JS가 채워주는 src를
    // 기다릴 수 없다). 그렇게 찾은 주소는 상대 경로/http:// 섞여 올 수
    // 있어 normalizeImageUrl 로 항상 완전한 https 절대 URL로 정규화한다.
    const $img = $item.find(".item_img_area img").first();
    const rawSrc = $img.attr("src");
    const fallbackSrc = $img.attr("data-src") || $img.attr("data-original");
    const bestSrc = !rawSrc || isPlaceholderImageSrc(rawSrc) ? fallbackSrc || rawSrc : rawSrc;
    const imageUrl = normalizeImageUrl(bestSrc);

    priceByGoodsId.set(goodsId, { consumerPrice, salePrice, imageUrl });
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
 * 샵 계정 로그인 상태로 받은 목록 페이지에서 실제 샵가(INSTRUCTOR 등급)를
 * 뽑는다. 실측으로 확인한 규칙(비로그인/로그인 응답을 직접 대조):
 *   - `.consumer_price`(취소선 정상가)는 로그인 여부와 무관하게 항상 동일
 *     (= 진짜 공개 소비자가). resolveRegularPrice가 이미 이 값을 price_retail로 쓴다.
 *   - `.sale_price`(노출가)만 로그인 시 회원 할인가로 바뀐다 — 즉 로그인
 *     상태의 sale_price가 곧 샵가다.
 *   - consumer_price 태그 자체가 없는(공개 할인이 전혀 없는) 상품은 샵
 *     할인도 없다는 뜻이라, 소비자가와 동일한 값을 그대로 쓴다.
 * 비로그인으로 크롤링했을 때(shopCookie 없음)는 이 함수를 아예 호출하지
 * 않고 null을 유지해, 기존에 저장된 price_instructor 값을 건드리지 않는다
 * (equipment-repo.ts upsertEquipmentMultiBrand 참고).
 */
function resolveInstructorPrice(
  domPrice: DomPriceEntry | undefined,
  retailPrice: number
): number | null {
  if (!domPrice) return null;
  if (domPrice.consumerPrice !== null && domPrice.consumerPrice > 0) {
    return domPrice.salePrice !== null && domPrice.salePrice > 0 ? domPrice.salePrice : null;
  }
  if (domPrice.salePrice !== null && domPrice.salePrice > 0) {
    return retailPrice;
  }
  return null;
}

/**
 * 수집한 원본 행들을 [브랜드, 카테고리, 모델명, 정상 소비자가격(할인 전)]
 * 단위 장비 목록으로 합친다(크롤링한 페이지 범위와 무관한 순수 변환 로직).
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
function mergeRawItemsIntoEquipment(
  rawItems: RawPongdangItem[],
  domPriceByGoodsId: Map<string, DomPriceEntry>,
  loggedIn: boolean
): { items: PongdangEquipmentItem[]; warnings: string[]; goodsIdByKey: Map<string, string> } {
  const warnings: string[] = [];

  // "스쿠버"/"스쿠버 acc" 로 정확히 태깅된 상품만 남기고(수영/물놀이, 캠핑,
  // 프리다이빙 등으로 교차 태그된 상품은 제외), 이벤트/초특가 등 프로모션
  // 상품(EXCLUDED_KEYWORDS 주석 참고)과 재입고 미정 품절 옵션(위 주석 참고)도
  // 추가로 제외한다.
  const scubaOnly = rawItems.filter(
    (item) =>
      INCLUDED_TOP_CATEGORIES.has(item.item_category) &&
      !isExcludedItem(item) &&
      !isOutOfStockIndefinitely(item)
  );

  // 같은 상품이 색상/사이즈 등 옵션(item_variant)별로 여러 행으로 내려오므로
  // (브랜드, 모델명) 기준으로 합치고, 대표 가격은 옵션 중 최저가로 둔다.
  // 색상/사이즈는 그 상품의 모든 옵션 행에서 parseVariantSegments 로 뽑아낸
  // 값을 Set 으로 누적한다(중복 제거, 끝에서 한글 기준으로 정렬).
  interface MergedAccumulator extends PongdangEquipmentItem {
    colorSet: Set<string>;
    sizeSet: Set<string>;
    /** 이 (브랜드,품명) 묶음에서 처음 본 행의 item_id(퐁당 goods_id). 상세
     *  페이지 옵션 보완(enrichLowVariantItems)이 /goods/view?no= 에 그대로 쓴다. */
    goodsId: string;
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
    const instructorPrice = loggedIn ? resolveInstructorPrice(domPrice, price) : null;

    if (existing) {
      // 더 싼 옵션(변형)이 나오면 대표 가격을 갱신한다 — 샵가도 같은 행의
      // 값으로 함께 갱신해(소비자가와 짝이 어긋나지 않게) price_retail과
      // 같은 조건에서만 바꾼다.
      if (price < existing.price_retail) {
        existing.price_retail = price;
        existing.price_instructor = instructorPrice;
      }
      // 썸네일은 옵션(색상/사이즈)별로 달라지지 않는 상품 대표 이미지라,
      // 처음 찾은 값을 그대로 유지한다(없었다가 나중 행에서 발견되면 채움).
      if (!existing.image_url && domPrice?.imageUrl) {
        existing.image_url = domPrice.imageUrl;
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
      price_instructor: instructorPrice,
      colors: [],
      sizes: [],
      image_url: domPrice?.imageUrl ?? null,
      colorSet: new Set(colors),
      sizeSet: new Set(sizes),
      goodsId: raw.item_id,
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
    price_instructor: acc.price_instructor,
    colors: Array.from(acc.colorSet).sort((a, b) => a.localeCompare(b, "ko")),
    sizes: Array.from(acc.sizeSet).sort((a, b) => a.localeCompare(b, "ko")),
    image_url: acc.image_url,
  }));

  const goodsIdByKey = new Map<string, string>(
    Array.from(merged.entries()).map(([key, acc]) => [key, acc.goodsId])
  );

  return { items, warnings, goodsIdByKey };
}

const DETAIL_PATH = "/goods/view";
/**
 * 조각(chunk) 1번 호출에서 상세페이지를 추가로 열어볼 상품 수 상한.
 *
 * 목록 페이지 API는 "그 페이지에 실제로 걸린 옵션 행" 만큼만 item_variant를
 * 내려주는데, 이게 그 상품의 전체 옵션과 항상 같지는 않다(실측으로 확인된
 * 사례: "델타 롱 5mm 부츠"가 목록에서는 사이즈 1개만 보였지만 실제로는
 * 여러 사이즈가 있었음). 색상/사이즈 합계가 1개 이하로 보이는 상품만
 * 상세페이지(/goods/view?no=)를 열어 실제 전체 옵션을 보완하되, 상품당
 * 요청이 1번 더 늘어나므로 상한을 둔다.
 *
 * [중요] route.ts 에 `export const maxDuration = 60` 이 선언돼 있지만,
 * Netlify 의 일반(백그라운드 아닌) 서버 함수는 이 값과 무관하게 응답
 * 시작까지 무응답 상태가 약 30초를 넘으면 플랫폼이 자체적으로
 * "Inactivity Timeout" 으로 끊어버린다 — Next.js 의 maxDuration 선언을
 * 그냥 무시하는 하드 리밋이다. 한 번 20으로 올려 실측했다가 조각 1번이
 * 30초를 넘겨 504로 끊기는 것을 직접 확인했다(멱등하지 않은 중간 상태로
 * 끊기므로 섣불리 올리면 안 됨) — 다만 그 실측은 동시 요청(아래
 * DETAIL_FETCH_CONCURRENCY) 도입 "이전" 값이었다. 동시 처리 3건 기준
 * 10건은 평균 약 21초보다 훨씬 여유로워, 배치 수(건수÷동시처리수)를
 * 그대로 유지한 채(10÷3≈4배치 → 20÷5≈4배치) 상한을 20으로, 동시 처리를
 * 5로 올려도 조각 1번의 벽시계 시간은 거의 그대로다(품절→재입고 복귀를
 * 더 빨리 잡아내기 위한 처리량 2배 증대, 2026-10-24).
 *
 * 카탈로그 전체를 하루 안에 다 보완하지 못해도, 매일 자동 동기화(Cron)가
 * 반복되며 option_checked_at 기준 라운드로빈으로 점진적으로 전수 보완된다
 * (selectEnrichmentCandidates 참고).
 */
export const MAX_DETAIL_FETCHES_PER_CHUNK = 20;

/**
 * 상세페이지 요청을 한 번에 몇 건까지 동시에 보낼지. 순차 요청(건당
 * ~1.8~2.4초)이 조각 1번의 30초 벽(위 MAX_DETAIL_FETCHES_PER_CHUNK 주석
 * 참고)을 거의 다 써버려서, 같은 요청 수를 동시에 묶어 보내 조각 1번의
 * 벽시계 시간을 줄인다 — 하루 총 요청 수 자체는 그대로이므로(더 많이
 * 가져오는 게 아니라 같은 양을 더 짧은 시간에 가져옴) 퐁당닷컴 서버에
 * 주는 부하가 실질적으로 늘지는 않는다. MAX_DETAIL_FETCHES_PER_CHUNK를
 * 10→20으로 올리면서 배치 수가 늘지 않도록 3→5로 함께 올렸다(10÷3≈4배치
 * → 20÷5≈4배치, 조각 1번의 벽시계 시간은 거의 그대로 유지).
 */
const DETAIL_FETCH_CONCURRENCY = 5;

/** fetchDetailPage 가 429(너무 많은 요청)/403(차단) 응답으로 실패했는지 확인한다.
 *  이런 응답이 오면 더 보내지 않고 즉시 멈춘다(isBlockingError 사용부 참고). */
function isBlockingError(reason: unknown): boolean {
  return reason instanceof Error && /\bHTTP (429|403)\b/.test(reason.message);
}

async function fetchDetailPage(goodsId: string): Promise<string> {
  const response = await axios.get<string>(`${BASE_URL}${DETAIL_PATH}`, {
    params: { no: goodsId },
    headers: {
      "User-Agent": USER_AGENT,
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

/** 상세페이지 옵션 라벨 끝에 붙는 "(품절)" 표시만 떼어낸다(예: "M 블랙크롬 (품절)" →
 *  "M 블랙크롬"). "M화이트(화이트스커트)"처럼 품절과 무관한 괄호 설명은 건드리지 않도록
 *  정확히 "(품절)"로 끝나는 경우만 매칭한다. */
function stripSoldOutSuffix(label: string): string {
  return label.replace(/\s*\(품절\)\s*$/, "").trim();
}

interface DetailPageOptions {
  /** 이 select가 담고 있는 옵션 종류. 첫 번째(안내용) <option>의 문구
   *  ("- 색상 선택 -", "- 사이즈 선택 -" 등)로 판별한다 — "- 렌즈 선택 -"처럼
   *  색상도 사이즈도 아닌 축이면 null(이 상품은 보완 대상에서 건너뜀). */
  axis: "color" | "size" | null;
  labels: string[];
}

/**
 * 상세페이지의 첫 번째 옵션 select(`id="0"`)에서 옵션들의 표시 텍스트를
 * 뽑는다. 품절(class="soldout"/disabled) 여부와 무관하게 전부 포함한다
 * — 구매 가능 여부와 별개로 "이 상품에 어떤 옵션이 존재하는지"를 빠짐없이
 * 보여주는 게 목적이라, 품절 표시(" (품절)" 접미사)만 라벨에서 떼어내고
 * 옵션 값 자체는 그대로 살린다.
 *
 * 색상/사이즈 구분은 라벨 텍스트를 색상 키워드 사전과 대조하는 방식(목록
 * 페이지의 자유 형식 item_variant 파싱에 쓰는 classifyVariantSegment)이
 * 아니라, select 자체의 안내 문구("- 색상 선택 -" 등)로 판별한다 — 퐁당
 * 사이트가 이미 "이 select는 색상 축이다/사이즈 축이다"를 명시해주므로
 * 이쪽이 훨씬 정확하다(키워드 사전에 없는 색상명 — 예: "코랄", "터키" —
 * 도 전부 포함된다).
 *
 * 이 select 는 1차원(색상만 또는 사이즈만 있는) 상품이면 전체 옵션이
 * 정적 HTML에 그대로 내려오지만, 2차원(색상+사이즈 두 단계) 상품의 두
 * 번째 select(`id="1"`)는 1차원 값을 고른 뒤 AJAX로만 채워지는 빈
 * 셀렉트라 정적 요청 1번으로는 가져올 수 없다(상품당 1+N번 요청이
 * 필요해 조각 1번의 비용으로는 너무 큼) — 그런 상품은 이 보완 대상에서
 * 자연히 제외되고(1차원 결과만으로도 합계가 1 초과가 되면 아래
 * enrichLowVariantItems 가 애초에 후보로 고르지 않음) 목록 페이지에서
 * 뽑힌 값만 그대로 쓴다.
 */
function extractDetailPageOptions(html: string): DetailPageOptions {
  const $ = cheerio.load(html);
  const select = $('select[name="viewOptions[]"][id="0"]').first();
  if (select.length === 0) return { axis: null, labels: [] };

  const placeholder = select.find("option").first().text();
  const axis: DetailPageOptions["axis"] = placeholder.includes("색상")
    ? "color"
    : placeholder.includes("사이즈")
      ? "size"
      : null;

  const labels: string[] = [];
  select.find("option").each((_, el) => {
    const $opt = $(el);
    const value = $opt.attr("value") ?? "";
    if (!value) return; // "- 색상 선택 -" 같은 안내용 첫 옵션
    const rawText = $opt.text().trim();
    // "[재입고 미정]"은 다시 입고될 계획 자체가 없다는 뜻이라(단순
    // 일시 품절과 다름) 이 옵션은 아예 제외한다(isOutOfStockIndefinitely
    // 와 동일한 "재입고미정" 판정 기준 재사용). 그 외의 품절 표시
    // ("(품절)" 접미사 — 다시 입고될 수 있는 일시 품절)는 표시만 떼어내고
    // 옵션 자체는 그대로 남긴다.
    if (rawText.replace(/\s+/g, "").includes(OUT_OF_STOCK_INDEFINITELY_MARK_NO_SPACE)) return;
    const text = stripSoldOutSuffix(rawText);
    if (text) labels.push(text);
  });
  return { axis, labels };
}

/** (브랜드,품명) 키 하나를 만든다 — goodsIdByKey/selectedKeys 조회에 그대로 쓴다. */
function itemKey(item: { brand: string; name: string }): string {
  return `${item.brand}\u0000${item.name}`;
}

/**
 * 목록 페이지 응답만으로는 색상/사이즈 옵션 합계가 1개 이하로 보이는
 * 상품들의 (브랜드,품명) 키 목록을 뽑는다. 실제로 이 중 몇 건을, 어떤
 * 순서로 상세페이지까지 열어볼지는 호출부가 DB의 option_checked_at
 * 값(가장 오래전에 확인했거나 아예 확인된 적 없는 품목 우선)을 기준으로
 * 고른다(lib/db/equipment-repo.ts selectEnrichmentCandidates 참고) —
 * 크롤러 자신은 "그 조각에서 가장 먼저 나온 N건"처럼 순서에 의존한
 * 선택을 하지 않는다(매일 같은 품목만 반복 보완되는 문제를 피하기 위함).
 */
export function selectLowVariantCandidates(
  items: PongdangEquipmentItem[]
): { brand: string; name: string }[] {
  return items
    .filter((item) => item.colors.length + item.sizes.length <= 1)
    .map((item) => ({ brand: item.brand, name: item.name }));
}

/**
 * selectedKeys 로 지정된 품목만 상세페이지를 열어 실제 전체 옵션 목록을
 * 보완한다 — 어떤 품목을 고를지는 호출부(selectLowVariantCandidates +
 * DB의 option_checked_at 기준 선정)가 결정하고, 이 함수는 그 선택대로
 * 가져오기만 한다. 보완(또는 애초에 선택되지 않은 경우) 후에도 옵션이
 * 전혀 없으면(진짜 단일 SKU) 색상에 "기본"을 채워, 화면에 빈 칸으로
 * 보이지 않게 한다.
 *
 * goodsIdByKey 는 (브랜드,품명) 키 → 목록에서 처음 본 item_id(퐁당
 * goods_id) 매핑이며, 상세페이지 URL(/goods/view?no=)에 그대로 쓴다.
 * items 는 제자리에서(in-place) colors/sizes 가 갱신된다.
 */
export async function enrichSelectedItems(
  items: PongdangEquipmentItem[],
  goodsIdByKey: Map<string, string>,
  selectedKeys: Set<string>
): Promise<{ warnings: string[]; checkedKeys: Set<string> }> {
  const warnings: string[] = [];
  const targets = items.filter((item) => selectedKeys.has(itemKey(item)));

  let enrichedCount = 0;
  let detailFetchFailures = 0;
  let blockedEarly = false;
  // 실제로 상세페이지 응답을 성공적으로 받아본 품목만 "확인됨"으로 친다
  // — 실패(차단 포함)한 품목은 option_checked_at 을 갱신하지 않아, 다음
  // 조각/날짜에 금방 다시 시도된다(몇 주씩 밀리지 않도록).
  const checkedKeys = new Set<string>();

  // DETAIL_FETCH_CONCURRENCY 건씩 묶어서 동시에 요청한다 — 조각 1번의
  // 벽시계 시간을 줄이기 위함이며, 묶음 수(targets.length)는 그대로라
  // 하루 총 요청 수는 바뀌지 않는다. 429/403 같은 차단성 응답을 하나라도
  // 받으면 그 즉시 더 보내지 않고 멈춘다.
  for (let i = 0; i < targets.length && !blockedEarly; i += DETAIL_FETCH_CONCURRENCY) {
    const batch = targets.slice(i, i + DETAIL_FETCH_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((item) => {
        const goodsId = goodsIdByKey.get(itemKey(item));
        return goodsId ? fetchDetailPage(goodsId) : Promise.reject(new Error("goodsId 없음"));
      })
    );

    settled.forEach((result, idx) => {
      if (result.status === "rejected") {
        detailFetchFailures += 1;
        if (isBlockingError(result.reason)) blockedEarly = true;
        return;
      }

      const item = batch[idx];
      checkedKeys.add(itemKey(item));
      const { axis, labels } = extractDetailPageOptions(result.value);
      if (axis === null || labels.length === 0) return;

      const colorSet = new Set(item.colors);
      const sizeSet = new Set(item.sizes);
      for (const label of labels) {
        if (axis === "size") sizeSet.add(label);
        else colorSet.add(label);
      }

      const nextColors = Array.from(colorSet).sort((a, b) => a.localeCompare(b, "ko"));
      const nextSizes = Array.from(sizeSet).sort((a, b) => a.localeCompare(b, "ko"));
      if (nextColors.length !== item.colors.length || nextSizes.length !== item.sizes.length) {
        enrichedCount += 1;
      }
      item.colors = nextColors;
      item.sizes = nextSizes;
    });

    if (!blockedEarly && i + DETAIL_FETCH_CONCURRENCY < targets.length) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  // 상세페이지를 열어봤든(위 targets) 상한 밖이라 열어보지 않았든, 최종
  // 색상/사이즈가 둘 다 비어 있으면 옵션이 전혀 없는 단일 SKU로 보고
  // "기본"을 채운다 — 상한 밖 상품은 다음 번 동기화(매일 자동 Cron)에서
  // 다시 후보로 잡혀 실제 옵션이 있다면 이 "기본" 값은 그때 덮어써진다.
  let fallbackCount = 0;
  for (const item of items) {
    if (item.colors.length === 0 && item.sizes.length === 0) {
      item.colors = ["기본"];
      fallbackCount += 1;
    }
  }

  if (blockedEarly) {
    warnings.push(
      "퐁당닷컴이 요청을 일시적으로 거부(429/403)하는 것으로 보여 이번 조각의 상세페이지 보완을 중단했습니다."
    );
  }
  if (enrichedCount > 0) {
    warnings.push(`상세페이지 보완으로 ${enrichedCount}건의 옵션 목록을 더 채웠습니다.`);
  }
  if (detailFetchFailures > 0) {
    warnings.push(
      `상세페이지 옵션 보완 중 ${detailFetchFailures}건은 요청에 실패해 건너뛰었습니다.`
    );
  }
  if (fallbackCount > 0) {
    warnings.push(`옵션이 전혀 없는 ${fallbackCount}건은 색상에 "기본" 값을 채웠습니다.`);
  }

  return { warnings, checkedKeys };
}

export interface PongdangCrawlChunkResult extends PongdangCrawlResult {
  /** 이 카테고리에서 다음에 이어 받아야 할 페이지 번호. 더 받을 페이지가 없으면 null. */
  nextPage: number | null;
  /** (브랜드,품명) 키 → 목록에서 처음 본 item_id(퐁당 goods_id). 서버
   *  내부에서만 쓰며(enrichSelectedItems 호출용), API 응답으로는 내려가지
   *  않는다(route.ts 가 별도 필드만 골라 JSON 응답을 만든다). */
  goodsIdByKey: Map<string, string>;
}

/**
 * 카테고리 하나, 페이지 몇 장(pagesPerChunk)만 크롤링한다.
 *
 * 전체 카테고리(c0002+c0003, 합쳐서 수십 페이지)를 한 번의 서버 함수
 * 호출 안에서 전부 처리하면(예전 crawlPongdangCatalog 방식) 수집 시간이
 * 60초 안팎까지 늘어나, Netlify 서버 함수의 실행 시간 제한을 넘겨 504
 * Gateway Timeout 으로 중간에 끊기는 문제가 실측으로 확인됐다(카탈로그가
 * 커질수록 더 쉽게 넘김). 그래서 카테고리 × 페이지 범위 단위로 잘게
 * 쪼개 호출하도록 바꾸고, 호출부(클라이언트)가 nextPage 를 받아 다음
 * 조각을 이어서 요청하는 방식으로 전체를 완성한다 — 호출 1번의 실행
 * 시간은 항상 pagesPerChunk 장 분량으로 짧게 유지된다.
 */
export async function crawlPongdangCategoryChunk(
  categoryCode: PongdangCategoryCode,
  startPage: number,
  pagesPerChunk: number
): Promise<PongdangCrawlChunkResult> {
  const warnings: string[] = [];
  const rawItems: RawPongdangItem[] = [];
  const domPriceByGoodsId = new Map<string, DomPriceEntry>();
  let pagesFetched = 0;
  let nextPage: number | null = null;

  // 조각(chunk)마다 새로 로그인한다 — 쿠키를 캐시/보관하지 않아 만료 걱정이
  // 없고, 실측 기준 로그인 자체는 1초 미만이라 조각 1번의 시간 예산에
  // 미치는 영향이 무시할 수준이다(fetchShopSessionCookie 주석 참고).
  // 로그인 실패/미설정이면 비로그인으로 조용히 폴백한다 — 색상/사이즈/
  // 소비자가 동기화는 평소대로 계속되고, 샵가(price_instructor)만
  // 이번 조각에서 수집되지 않는다(기존 저장값은 유지됨).
  const { cookie: shopCookie, failReason: shopLoginFailReason } = await fetchShopSessionCookie();
  if (!shopCookie) {
    warnings.push(
      `퐁당닷컴 샵 계정 로그인에 실패해 이번 조각은 샵가(공급가) 수집 없이 진행했습니다. 기존 샵가 값은 그대로 유지됩니다. (사유: ${shopLoginFailReason})`
    );
  }

  const lastPageInChunk = Math.min(startPage + pagesPerChunk - 1, MAX_PAGES);

  for (let page = startPage; page <= lastPageInChunk; page += 1) {
    let html: string;
    try {
      html = await fetchSearchListPage(page, categoryCode, shopCookie);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      warnings.push(`[${categoryCode}] ${page}페이지 요청 실패: ${message}`);
      break;
    }

    pagesFetched += 1;
    const pageItems = extractRawItems(html);

    if (pageItems.length === 0) break;

    rawItems.push(...pageItems);
    // 같은 HTML 응답 안에서 가격은 DOM(.consumer_price/.sale_price)으로 별도 추출한다.
    for (const [goodsId, entry] of extractDomPrices(html)) {
      domPriceByGoodsId.set(goodsId, entry);
    }

    if (pageItems.length < PAGE_SIZE) break;

    // 이 페이지가 꽉 찼다(더 받을 페이지가 있을 수 있다) — 다음 조각이
    // 이어 받을 페이지 번호를 기록한다. 청크 상한(lastPageInChunk)에
    // 걸려서 루프가 끝난 경우에만 의미가 있고, 그 전에 break 로 빠져나간
    // 경우(빈 응답/요청 실패)는 아래에서 null 로 남는다.
    if (page === lastPageInChunk && page < MAX_PAGES) {
      nextPage = page + 1;
    }

    await sleep(REQUEST_DELAY_MS);
  }

  if (startPage === 1 && pagesFetched === 0) {
    warnings.push(`[${categoryCode}] 응답이 없어 이 카테고리는 건너뛰었습니다.`);
  }

  const { items, warnings: mergeWarnings, goodsIdByKey } = mergeRawItemsIntoEquipment(
    rawItems,
    domPriceByGoodsId,
    shopCookie !== null
  );
  const distinctBrandCount = new Set(items.map((item) => item.brand)).size;

  return {
    items,
    warnings: [...warnings, ...mergeWarnings],
    pagesFetched,
    distinctBrandCount,
    nextPage,
    goodsIdByKey,
  };
}
