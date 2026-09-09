import "server-only";
import axios from "axios";
import * as cheerio from "cheerio";
import type { ParsedEquipmentItem } from "@/lib/equipment/types";

const BASE_URL = "https://pongdang.com";
const LIST_PATH = "/goods/search_list";
/** "스쿠버" 최상위 카테고리 코드. 하위 전 카테고리(마스크/핀/슈트/호흡기/컴퓨터 등)를 한 번에 포함한다. */
const CATEGORY_CODE = "c0002";
const REFERER = `${BASE_URL}/goods/catalog?code=0002`;
const USER_AGENT =
  "Mozilla/5.0 (compatible; DiveEstimateCatalogSync/1.0; +internal equipment price sync)";
const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_DELAY_MS = 400;
/** 사이트가 실제로 허용하는 페이지당 최대 상품 수(실측 확인. 이보다 큰 값은 무시되고 기본값 40으로 응답). */
const PAGE_SIZE = 200;
/** 페이지네이션 안전장치. 실측 기준 29페이지(5,659건)보다 여유 있게 잡아, 마크업/응답 변경 시 무한루프를 막는다. */
const MAX_PAGES = 60;
/** 한국 부가가치세율(10%). RawPongdangItem.price(할인 후, 부가세 제외)를 정상가로 역산할 때 필요. */
const VAT_RATE = 1.1;

/**
 * 퐁당닷컴 item_category2(사이트 자체 세부 카테고리) → 우리 장비 마스터
 * 카테고리 매핑. 실제 API 응답(5,005건, "스쿠버" 태그 기준)을 전수 조사해
 * 확인한 25개 값을 모두 반영했다.
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
};
const DEFAULT_CATEGORY = "기타";

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

async function fetchSearchListPage(pageNo: number): Promise<string> {
  const response = await axios.get<string>(`${BASE_URL}${LIST_PATH}`, {
    params: {
      category: CATEGORY_CODE,
      searchMode: "catalog",
      page: pageNo,
      per: PAGE_SIZE,
    },
    headers: {
      "User-Agent": USER_AGENT,
      "X-Requested-With": "XMLHttpRequest",
      Referer: REFERER,
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

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let html: string;
    try {
      html = await fetchSearchListPage(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      warnings.push(`${page}페이지 요청 실패: ${message}`);
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

    await sleep(REQUEST_DELAY_MS);
  }

  // "스쿠버" 카테고리로 정확히 태깅된 상품만 남긴다.
  // (수영/물놀이, 캠핑, 프리다이빙 등으로 교차 태그된 상품은 제외)
  const scubaOnly = rawItems.filter((item) => item.item_category === "스쿠버");

  // 같은 상품이 색상/사이즈 등 옵션(item_variant)별로 여러 행으로 내려오므로
  // (브랜드, 모델명) 기준으로 합치고, 대표 가격은 옵션 중 최저가로 둔다.
  const merged = new Map<string, PongdangEquipmentItem>();
  const skippedNoPriceNames: string[] = [];
  let fallbackUsedCount = 0;

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

    if (existing) {
      // 더 싼 옵션(변형)이 나오면 대표 가격을 갱신한다.
      if (price < existing.price_retail) {
        existing.price_retail = price;
      }
      continue;
    }

    merged.set(key, {
      brand,
      category: mapCategory(raw.item_category2 ?? ""),
      name,
      price_retail: price,
      colors: [],
      sizes: [],
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

  const items = Array.from(merged.values());
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

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let html: string;
    try {
      html = await fetchSearchListPage(page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      warnings.push(`${page}페이지 요청 실패: ${message}`);
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

  const brandRates: BrandDiscountRateSummary[] = Array.from(brandRateSamples.entries()).map(
    ([brand, samples]) => ({
      brand,
      ratePercent: Math.round((samples.reduce((s, r) => s + r, 0) / samples.length) * 10) / 10,
      sampleCount: samples.length,
    })
  );

  return { brandRates, warnings, pagesFetched };
}
