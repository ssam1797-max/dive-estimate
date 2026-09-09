import "server-only";
import { Type } from "@google/genai";
import { getGeminiClient } from "@/lib/gemini/client";
import type { PdfPageText } from "@/lib/pdf/extractPdfText";
import { parsedEquipmentListSchema } from "@/lib/equipment/schema";
import {
  CATALOG_EXTRACTION_MAX_TOKENS,
  CATALOG_EXTRACTION_MODEL,
  MAX_CHUNK_CHARS,
} from "@/lib/equipment/constants";
import type { CatalogExtractionResult, ParsedEquipmentItem } from "@/lib/equipment/types";

interface CatalogChunk {
  startPage: number;
  endPage: number;
  text: string;
}

/**
 * 페이지별 텍스트를 MAX_CHUNK_CHARS 를 넘지 않는 선에서 여러 페이지씩 묶습니다.
 * 제품 정보가 페이지 경계에서 잘리는 것을 최소화하기 위해, 문자 수가 아닌
 * "페이지" 단위로만 자릅니다. (페이지 하나가 임계값을 넘더라도 그 페이지 단독으로 청크 처리)
 */
function buildChunks(pages: PdfPageText[]): CatalogChunk[] {
  const chunks: CatalogChunk[] = [];
  let currentPages: PdfPageText[] = [];
  let currentLength = 0;

  const flush = () => {
    if (currentPages.length === 0) return;
    chunks.push({
      startPage: currentPages[0].pageNumber,
      endPage: currentPages[currentPages.length - 1].pageNumber,
      text: currentPages
        .map((page) => `--- 페이지 ${page.pageNumber} ---\n${page.text}`)
        .join("\n\n"),
    });
    currentPages = [];
    currentLength = 0;
  };

  for (const page of pages) {
    const pageLength = page.text.length;

    if (currentPages.length > 0 && currentLength + pageLength > MAX_CHUNK_CHARS) {
      flush();
    }

    currentPages.push(page);
    currentLength += pageLength;
  }

  flush();

  return chunks;
}

function buildSystemPrompt(brand: string, catalogYear: number): string {
  return `당신은 스쿠버다이빙 장비 브랜드 카탈로그의 원문 텍스트를 분석해서, 판매 중인 장비(제품) 목록을 데이터베이스에 등록할 수 있는 형태로 정형화하는 전문 어시스턴트입니다.

지금 전달받는 텍스트는 "${brand}" 브랜드의 ${catalogYear}년도 카탈로그 중 일부(페이지 범위)입니다. 아래 규칙을 반드시 지켜서 결과를 JSON 배열로만 응답하세요.

1. 실제로 판매되는 개별 장비(제품) 항목만 추출하세요. 표지, 목차, 브랜드/회사 소개, 마케팅 문구, 페이지 번호, 색인 등은 무시하세요.
2. category(장비 종류)는 아래 다이빙 업계 표준 한글 용어 중 가장 적합한 것을 사용하세요. 목록에 정확히 맞는 것이 없으면 가장 가까운 한글 용어를 사용하세요.
   BCD, 레귤레이터, 슈트, 마스크, 스노클, 핀, 다이빙 컴퓨터, 웨이트 시스템, 부츠, 장갑, 후드, 다이빙 라이트, 게이지, 가방, 기타
3. name(장비명)에는 브랜드명("${brand}")을 반복하지 말고 모델명만 기입하세요.
4. price_retail(소비자 가격)은 통화 기호(₩, $, 원 등)나 천 단위 구분 콤마를 제거한 숫자만 기입하세요.
   - 사이즈/색상에 따라 가격이 다르게 표기된 경우, 가장 일반적으로(가장 많이) 표기된 가격 하나만 대표값으로 사용하세요.
   - 가격 정보를 전혀 찾을 수 없는 제품은 결과에서 제외하세요.
5. colors(색상), sizes(사이즈)는 카탈로그에 표기된 표현을 그대로 배열에 담고, 해당 정보가 없으면 빈 배열로 두세요.
6. 같은 모델이 색상/사이즈만 다르게 여러 줄로 반복 표기된 경우, 하나의 항목으로 합치고 colors/sizes 배열에 모두 담으세요. (같은 모델을 여러 항목으로 중복 생성하지 마세요)
7. 이 페이지 범위에 실제 제품 정보가 없다면 빈 배열 []을 반환하세요.
8. 반드시 아래 형식과 정확히 일치하는 JSON 배열만 응답하세요. 그 외의 설명 텍스트, 마크다운 코드블록 표시는 출력하지 마세요.
   [ { "category": string, "name": string, "price_retail": number, "colors": string[], "sizes": string[] } ]`;
}

/** Gemini 구조화 출력(responseSchema)에 사용하는 JSON 스키마: ParsedEquipmentItem[] */
const EQUIPMENT_LIST_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: "장비 종류 (예: BCD, 레귤레이터, 슈트, 마스크, 핀 등 업계 표준 한글 용어)",
      },
      name: {
        type: Type.STRING,
        description: "장비명(모델명). 브랜드명은 제외.",
      },
      price_retail: {
        type: Type.NUMBER,
        description: "소비자 가격(정가). 통화 기호/콤마 없이 숫자만.",
      },
      colors: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "선택 가능한 색상 목록. 없으면 빈 배열.",
      },
      sizes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "선택 가능한 사이즈 목록. 없으면 빈 배열.",
      },
    },
    required: ["category", "name", "price_retail", "colors", "sizes"],
  },
};

interface ChunkExtractionFailure {
  message: string;
}

/**
 * 디버깅/경고 메시지에 원문 응답 일부를 안전하게 덧붙이기 위한 헬퍼.
 * 카탈로그 원문이 그대로 노출되지 않도록 길이를 제한한다.
 */
function truncateForMessage(text: string, maxLength = 200): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

/**
 * 청크(페이지 범위) 하나를 Gemini 에 전달해 장비 목록을 추출합니다.
 * 실패 시 { ok: false, failure } 를 반환하고, 호출부에서 warnings 에 기록하도록 합니다.
 */
async function extractItemsFromChunk(
  chunk: CatalogChunk,
  brand: string,
  catalogYear: number
): Promise<
  { ok: true; items: ParsedEquipmentItem[] } | { ok: false; failure: ChunkExtractionFailure }
> {
  const client = getGeminiClient();

  let text: string | undefined;
  let finishReason: string | undefined;

  try {
    const response = await client.models.generateContent({
      model: CATALOG_EXTRACTION_MODEL,
      contents: `[${chunk.startPage}~${chunk.endPage} 페이지 원문]\n\n${chunk.text}`,
      config: {
        systemInstruction: buildSystemPrompt(brand, catalogYear),
        responseMimeType: "application/json",
        responseSchema: EQUIPMENT_LIST_RESPONSE_SCHEMA,
        // CATALOG_EXTRACTION_MODEL 은 responseSchema 와 함께 thinkingConfig
        // (thinkingBudget: 0 포함)를 지정하면 400 INVALID_ARGUMENT 를 반환하므로
        // thinkingConfig 는 지정하지 않는다. 대신 내부 thinking 이 예산을
        // 소비하더라도 JSON 출력이 잘리지 않도록 maxOutputTokens 를 넉넉히 둔다.
        maxOutputTokens: CATALOG_EXTRACTION_MAX_TOKENS,
      },
    });

    text = response.text;
    finishReason = response.candidates?.[0]?.finishReason;

    if (!text) {
      const reasonHint =
        finishReason === "MAX_TOKENS"
          ? ` (finishReason=MAX_TOKENS: 출력 토큰 한도를 초과해 응답이 비어 있습니다.)`
          : finishReason
            ? ` (finishReason=${finishReason})`
            : "";
      throw new Error(`모델 응답에서 텍스트를 찾을 수 없습니다.${reasonHint}`);
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gemini API 호출 중 알 수 없는 오류가 발생했습니다.";
    console.error(`카탈로그 ${chunk.startPage}~${chunk.endPage} 페이지 Gemini 호출 실패:`, error);
    return {
      ok: false,
      failure: {
        message: `${chunk.startPage}~${chunk.endPage} 페이지: Gemini API 호출에 실패했습니다. (${message})`,
      },
    };
  }

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 파싱 오류";
    const truncatedHint =
      finishReason === "MAX_TOKENS"
        ? " 응답이 출력 토큰 한도로 인해 중간에 잘렸을 가능성이 높습니다."
        : "";
    console.error(
      `카탈로그 ${chunk.startPage}~${chunk.endPage} 페이지 JSON 파싱 실패:`,
      error,
      "\n원문 일부:",
      truncateForMessage(text)
    );
    return {
      ok: false,
      failure: {
        message: `${chunk.startPage}~${chunk.endPage} 페이지: 모델 응답을 JSON 으로 해석하지 못했습니다.${truncatedHint} (${message}) 응답 일부: "${truncateForMessage(
          text,
          120
        )}"`,
      },
    };
  }

  const parsed = parsedEquipmentListSchema.safeParse({ items: rawItems });

  if (!parsed.success) {
    const issueMessage = parsed.error.issues.map((issue) => issue.message).join(", ");
    console.error(
      `카탈로그 ${chunk.startPage}~${chunk.endPage} 페이지 응답 스키마 검증 실패:`,
      parsed.error.issues
    );
    return {
      ok: false,
      failure: {
        message: `${chunk.startPage}~${chunk.endPage} 페이지: 모델 응답 형식이 예상과 다릅니다. (${issueMessage})`,
      },
    };
  }

  return { ok: true, items: parsed.data.items };
}

/**
 * PDF 페이지 텍스트 전체를 청크로 나누어 순차적으로 Gemini 에 전달하고,
 * 결과를 하나의 장비 목록으로 합칩니다. 일부 청크가 실패해도 전체를
 * 중단하지 않고 warnings 에 기록한 뒤 나머지 청크를 계속 처리합니다.
 */
export async function extractEquipmentFromCatalog(
  pages: PdfPageText[],
  brand: string,
  catalogYear: number
): Promise<CatalogExtractionResult> {
  const chunks = buildChunks(pages.filter((page) => page.text.trim().length > 0));

  if (chunks.length === 0) {
    return { items: [], warnings: ["PDF 에서 추출할 수 있는 텍스트가 없습니다."] };
  }

  const items: ParsedEquipmentItem[] = [];
  const warnings: string[] = [];

  for (const chunk of chunks) {
    const result = await extractItemsFromChunk(chunk, brand, catalogYear);

    if (!result.ok) {
      warnings.push(result.failure.message);
      continue;
    }

    items.push(...result.items);
  }

  return { items, warnings };
}
