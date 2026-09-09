import "server-only";
import https from "node:https";
import tls from "node:tls";
import axios from "axios";
import * as cheerio from "cheerio";
import type { ParsedEquipmentItem } from "@/lib/equipment/types";

const BASE_URL = "https://www.scubapro.co.kr";
const LIST_PATH = "/product/index.jsp";
const USER_AGENT =
  "Mozilla/5.0 (compatible; DiveEstimateCatalogSync/1.0; +internal equipment price sync)";
const REQUEST_TIMEOUT_MS = 15000;
const REQUEST_DELAY_MS = 400;

/**
 * scubapro.co.kr 서버는 TLS 핸드셰이크 시 리프 인증서(issuer: "Sectigo Public
 * Server Authentication CA DV R36")와 맞지 않는 구버전 중간 인증서 체인을 함께
 * 보내고 있어(서버 설정 오류로 확인됨), Node 의 기본 TLS 검증기는 신뢰 경로를
 * 완성하지 못해 "unable to verify the first certificate" 로 실패한다.
 * curl/브라우저는 OS 트러스트스토어의 AIA(Authority Information Access) 체이싱으로
 * 누락된 중간 인증서를 자동 보완해 통과하지만, Node 의 OpenSSL 기반 검증기는 이를
 * 하지 않는다. 아래는 그 누락된 중간 인증서(만료 2036-03-21)를 Node 기본 루트
 * 인증서 목록에 추가로 신뢰시켜, 검증을 우회하지 않고 정상적으로 완성시킨다.
 * (crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt 에서 확보)
 */
const SCUBAPRO_MISSING_INTERMEDIATE_CA = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQOXpmzCdWNi4NqofKbqvjsTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgRFYgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEAljZf2HIz7+SPUPQCQObZYcrxLTHYdf1ZtMRe7Yeq
RPSwygz16qJ9cAWtWNTcuICc++p8Dct7zNGxCpqmEtqifO7NvuB5dEVexXn9RFFH
12Hm+NtPRQgXIFjx6MSJcNWuVO3XGE57L1mHlcQYj+g4hny90aFh2SCZCDEVkAja
EMMfYPKuCjHuuF+bzHFb/9gV8P9+ekcHENF2nR1efGWSKwnfG5RawlkaQDpRtZTm
M64TIsv/r7cyFO4nSjs1jLdXYdz5q3a4L0NoabZfbdxVb+CUEHfB0bpulZQtH1Rv
38e/lIdP7OTTIlZh6OYL6NhxP8So0/sht/4J9mqIGxRFc0/pC8suja+wcIUna0HB
pXKfXTKpzgis+zmXDL06ASJf5E4A2/m+Hp6b84sfPAwQ766rI65mh50S0Di9E3Pn
2WcaJc+PILsBmYpgtmgWTR9eV9otfKRUBfzHUHcVgarub/XluEpRlTtZudU5xbFN
xx/DgMrXLUAPaI60fZ6wA+PTAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQUaMASFhgOr872h6YyV6NGUV3LBycw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgEw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
YtOC9Fy+TqECFw40IospI92kLGgoSZGPOSQXMBqmsGWZUQ7rux7cj1du6d9rD6C8
ze1B2eQjkrGkIL/OF1s7vSmgYVafsRoZd/IHUrkoQvX8FZwUsmPu7amgBfaY3g+d
q1x0jNGKb6I6Bzdl6LgMD9qxp+3i7GQOnd9J8LFSietY6Z4jUBzVoOoz8iAU84OF
h2HhAuiPw1ai0VnY38RTI+8kepGWVfGxfBWzwH9uIjeooIeaosVFvE8cmYUB4TSH
5dUyD0jHct2+8ceKEtIoFU/FfHq/mDaVnvcDCZXtIgitdMFQdMZaVehmObyhRdDD
4NQCs0gaI9AAgFj4L9QtkARzhQLNyRf87Kln+YU0lgCGr9HLg3rGO8q+Y4ppLsOd
unQZ6ZxPNGIfOApbPVf5hCe58EZwiWdHIMn9lPP6+F404y8NNugbQixBber+x536
WrZhFZLjEkhp7fFXf9r32rNPfb74X/U90Bdy4lzp3+X1ukh1BuMxA/EEhDoTOS3l
7ABvc7BYSQubQ2490OcdkIzUh3ZwDrakMVrbaTxUM2p24N6dB+ns2zptWCva6jzW
r8IWKIMxzxLPv5Kt3ePKcUdvkBU/smqujSczTzzSjIoR5QqQA6lN1ZRSnuHIWCvh
JEltkYnTAH41QJ6SAWO66GrrUESwN/cgZzL4JLEqz1Y=
-----END CERTIFICATE-----`;

const scubaproHttpsAgent = new https.Agent({
  ca: [...tls.rootCertificates, SCUBAPRO_MISSING_INTERMEDIATE_CA],
});
/** 페이지네이션 안전장치. 실제 재고량을 훨씬 웃도는 값으로, 마크업 변경 시 무한루프를 막는다. */
const MAX_PAGES_PER_TARGET = 15;
const ITEMS_PER_PAGE = 20;

interface CrawlTarget {
  sdepth1: string;
  sdepth2: string;
  category: string;
}

/**
 * scubapro.co.kr 좌측 카테고리 내비게이션(sdepth1/sdepth2)을 우리 장비 마스터의
 * 카테고리 체계로 수동 매핑한다. 아래 두 그룹은 의도적으로 제외한다.
 * - "NEW": 전 카테고리 신상품을 한 번 더 모아 보여주는 중복 뷰
 * - "기타 브랜드": 스쿠버프로가 아닌 타사 브랜드(스파이더코/DIVEPRO/JJ-CCR 등) 판매 코너
 */
const CRAWL_TARGETS: CrawlTarget[] = [
  { sdepth1: "호흡기", sdepth2: "세트시스템", category: "레귤레이터" },
  { sdepth1: "호흡기", sdepth2: "1단계", category: "레귤레이터" },
  { sdepth1: "호흡기", sdepth2: "2단계", category: "레귤레이터" },
  { sdepth1: "호흡기", sdepth2: "옥토퍼스", category: "레귤레이터" },
  { sdepth1: "부력조절기", sdepth2: "자켓형", category: "BCD" },
  { sdepth1: "부력조절기", sdepth2: "백플레이트형", category: "BCD" },
  { sdepth1: "부력조절기", sdepth2: "테크니컬", category: "BCD" },
  { sdepth1: "슈트", sdepth2: "웻슈트", category: "슈트" },
  { sdepth1: "슈트", sdepth2: "레쉬가드", category: "슈트" },
  { sdepth1: "슈트", sdepth2: "글로브", category: "장갑" },
  { sdepth1: "슈트", sdepth2: "후드/부츠", category: "후드" },
  { sdepth1: "핀", sdepth2: "오픈힐", category: "핀" },
  { sdepth1: "핀", sdepth2: "풀풋", category: "핀" },
  { sdepth1: "마스크&스노클", sdepth2: "마스크", category: "마스크" },
  { sdepth1: "마스크&스노클", sdepth2: "스노클", category: "스노클" },
  { sdepth1: "가방", sdepth2: "롤러백", category: "가방" },
  { sdepth1: "가방", sdepth2: "드라이백", category: "가방" },
  { sdepth1: "가방", sdepth2: "휴대용가방", category: "가방" },
  { sdepth1: "액세서리", sdepth2: "나이프", category: "기타" },
  { sdepth1: "액세서리", sdepth2: "라이트", category: "다이빙 라이트" },
  { sdepth1: "액세서리", sdepth2: "기타 액세서리", category: "기타" },
  { sdepth1: "컴퓨터", sdepth2: "컴퓨터", category: "다이빙 컴퓨터" },
  { sdepth1: "컴퓨터", sdepth2: "게이지", category: "게이지" },
  { sdepth1: "컴퓨터", sdepth2: "나침반", category: "기타" },
  { sdepth1: "S-TEK", sdepth2: "부력조절기", category: "BCD" },
  { sdepth1: "S-TEK", sdepth2: "액세서리", category: "기타" },
  { sdepth1: "S-TEK", sdepth2: "호흡기", category: "레귤레이터" },
];

export interface CrawlResult {
  items: ParsedEquipmentItem[];
  warnings: string[];
  targetsProcessed: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchListPageHtml(
  sdepth1: string,
  sdepth2: string,
  pageNo: number
): Promise<string> {
  const response = await axios.get<string>(`${BASE_URL}${LIST_PATH}`, {
    params: { sdepth1, sdepth2, reqPageNo: pageNo },
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "ko-KR,ko;q=0.9",
    },
    httpsAgent: scubaproHttpsAgent,
    timeout: REQUEST_TIMEOUT_MS,
    responseType: "text",
    // 4xx/5xx 도 여기서 직접 판단해서 warnings 에 담기 위해 axios 가 던지지 않게 한다.
    validateStatus: () => true,
  });

  if (response.status !== 200) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.data;
}

/**
 * "후드/부츠"처럼 사이트에서 하나의 카테고리로 묶여 있지만 우리 체계에서는
 * 나뉘어 있는 경우, 상품명 키워드로 세분화한다.
 */
function refineCategory(target: CrawlTarget, name: string): string {
  if (target.sdepth1 === "슈트" && target.sdepth2 === "후드/부츠") {
    return /부츠|boot/i.test(name) ? "부츠" : "후드";
  }
  return target.category;
}

interface ParsedListPage {
  items: ParsedEquipmentItem[];
  /** 가격 유무와 무관하게, 이 페이지에 실제로 나열된 상품(li) 수. 페이지네이션 종료 판단용. */
  rowCount: number;
}

function parseListPage(html: string, target: CrawlTarget): ParsedListPage {
  const $ = cheerio.load(html);
  const rows = $(".mcon03 ul li");
  const items: ParsedEquipmentItem[] = [];

  rows.each((_, el) => {
    const nameRaw = $(el)
      .find(".txt_part p")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\[NEW\]\s*/i, "");

    if (!nameRaw) return;

    const priceRaw = $(el).find(".txt_part .price strong").first().text();
    const priceDigits = priceRaw.replace(/[^0-9]/g, "");

    // "가격문의" 등 소비자가가 명시되지 않은 상품은 가격 데이터가 없으므로 제외한다.
    if (!priceDigits) return;

    const price = Number(priceDigits);
    if (!Number.isFinite(price) || price <= 0) return;

    items.push({
      category: refineCategory(target, nameRaw),
      name: nameRaw,
      price_retail: price,
      colors: [],
      sizes: [],
    });
  });

  return { items, rowCount: rows.length };
}

/**
 * 스쿠버프로 코리아 공식 홈페이지(scubapro.co.kr)의 제품 목록 페이지를
 * 카테고리별로 순회하며 [카테고리, 모델명, 소비자가격]을 수집한다.
 *
 * 가격은 사이트의 `.price strong` 요소에 이미 정형화된 텍스트("2,788,000")로
 * 노출되므로, AI 파싱 없이 직접 파싱한다. 금액 데이터를 LLM에 맡기면 자릿수
 * 누락/환각 등으로 가격이 틀릴 위험이 있어, 구조가 이미 명확한 이 값은
 * 결정론적으로 추출하는 쪽이 훨씬 안전하다.
 */
export async function crawlScubaproCatalog(): Promise<CrawlResult> {
  const items: ParsedEquipmentItem[] = [];
  const warnings: string[] = [];
  const seenNames = new Set<string>();

  for (const target of CRAWL_TARGETS) {
    const targetLabel = `${target.sdepth1} > ${target.sdepth2}`;
    let targetItemCount = 0;

    for (let pageNo = 1; pageNo <= MAX_PAGES_PER_TARGET; pageNo += 1) {
      let html: string;
      try {
        html = await fetchListPageHtml(target.sdepth1, target.sdepth2, pageNo);
      } catch (error) {
        const message = error instanceof Error ? error.message : "알 수 없는 오류";
        warnings.push(`${targetLabel} (${pageNo}페이지) 요청 실패: ${message}`);
        break;
      }

      const { items: pageItems, rowCount } = parseListPage(html, target);

      if (rowCount === 0) break;

      for (const item of pageItems) {
        if (seenNames.has(item.name)) continue;
        seenNames.add(item.name);
        items.push(item);
      }
      targetItemCount += pageItems.length;

      if (rowCount < ITEMS_PER_PAGE) break;

      await sleep(REQUEST_DELAY_MS);
    }

    if (targetItemCount === 0) {
      warnings.push(`${targetLabel}: 가격이 표시된 상품을 찾지 못했습니다.`);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { items, warnings, targetsProcessed: CRAWL_TARGETS.length };
}
