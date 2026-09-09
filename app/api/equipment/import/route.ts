import { NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { extractEquipmentFromCatalog } from "@/lib/equipment/extractEquipmentFromCatalog";
import { upsertEquipment } from "@/lib/equipment/upsertEquipment";
import { equipmentImportRequestSchema } from "@/lib/equipment/schema";
import {
  ALLOWED_PDF_MIME_TYPES,
  MAX_PDF_FILE_SIZE_BYTES,
} from "@/lib/equipment/constants";
import type { EquipmentImportSummary } from "@/lib/equipment/types";

// pdf-parse 는 Node.js 전용 API(파일 시스템, 네이티브 모듈)를 사용하므로
// Edge 런타임이 아닌 Node.js 런타임에서 실행되어야 합니다.
export const runtime = "nodejs";
// 카탈로그 페이지 수에 따라 여러 번의 Gemini 호출이 순차적으로 일어날 수 있어
// 기본 제한보다 넉넉한 처리 시간이 필요합니다.
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "요청 형식이 올바르지 않습니다. (multipart/form-data 필요)" },
        { status: 400 }
      );
    }

    const brandRaw = formData.get("brand");
    const catalogYearRaw = formData.get("catalogYear");
    const file = formData.get("file");

    if (typeof brandRaw !== "string" || typeof catalogYearRaw !== "string") {
      return NextResponse.json(
        { error: "brand, catalogYear 값이 필요합니다." },
        { status: 400 }
      );
    }

    const parsedRequest = equipmentImportRequestSchema.safeParse({
      brand: brandRaw,
      catalogYear: Number(catalogYearRaw),
    });

    if (!parsedRequest.success) {
      return NextResponse.json(
        {
          error: parsedRequest.error.issues.map((issue) => issue.message).join(" "),
        },
        { status: 400 }
      );
    }

    const { brand, catalogYear } = parsedRequest.data;

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "PDF 파일이 필요합니다." },
        { status: 400 }
      );
    }

    if (!ALLOWED_PDF_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "PDF 파일만 업로드할 수 있습니다." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "빈 파일은 업로드할 수 없습니다." },
        { status: 400 }
      );
    }

    if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: `파일 용량이 너무 큽니다. 최대 ${
            MAX_PDF_FILE_SIZE_BYTES / (1024 * 1024)
          }MB 까지 업로드할 수 있습니다.`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const pdfResult = await extractPdfText(buffer);

    if (pdfResult.pages.every((page) => page.text.trim().length === 0)) {
      return NextResponse.json(
        {
          error:
            "PDF 에서 텍스트를 찾을 수 없습니다. 스캔 이미지로만 구성된 PDF 는 지원하지 않습니다.",
        },
        { status: 422 }
      );
    }

    const extraction = await extractEquipmentFromCatalog(
      pdfResult.pages,
      brand,
      catalogYear
    );

    if (extraction.items.length === 0) {
      return NextResponse.json(
        {
          error:
            "카탈로그에서 장비 항목을 추출하지 못했습니다. 다른 파일로 다시 시도해주세요.",
          warnings: extraction.warnings,
        },
        { status: 422 }
      );
    }

    const upsertResult = await upsertEquipment(
      brand,
      catalogYear,
      extraction.items
    );

    const summary: EquipmentImportSummary = {
      brand,
      catalogYear,
      totalPages: pdfResult.totalPages,
      totalParsed: extraction.items.length,
      insertedCount: upsertResult.insertedCount,
      updatedCount: upsertResult.updatedCount,
      failedCount: upsertResult.failedCount,
      items: upsertResult.items,
      warnings: extraction.warnings,
    };

    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("장비 카탈로그 업로드 처리 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
