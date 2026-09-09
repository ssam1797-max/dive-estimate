import "server-only";
import { PDFParse } from "pdf-parse";

export interface PdfPageText {
  /** 1부터 시작하는 페이지 번호 */
  pageNumber: number;
  text: string;
}

export interface PdfExtractionResult {
  totalPages: number;
  pages: PdfPageText[];
  /** 전체 페이지 텍스트를 합친 문자열 (참고용) */
  fullText: string;
}

/**
 * PDF 버퍼에서 페이지별 텍스트를 추출합니다.
 * 실패 시(암호화된 PDF, 손상된 파일 등) 사용자에게 보여줄 수 있는
 * 한국어 에러 메시지를 담아 예외를 던집니다.
 */
export async function extractPdfText(
  buffer: Buffer
): Promise<PdfExtractionResult> {
  let parser: PDFParse | null = null;

  try {
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();

    const pages: PdfPageText[] = result.pages.map((page) => ({
      pageNumber: page.num,
      text: page.text ?? "",
    }));

    return {
      totalPages: result.total,
      pages,
      fullText: result.text ?? "",
    };
  } catch (error) {
    console.error("PDF 텍스트 추출 실패:", error);
    throw new Error(
      "PDF 파일에서 텍스트를 추출하지 못했습니다. 파일이 손상되었거나 암호로 보호되어 있을 수 있습니다."
    );
  } finally {
    if (parser) {
      try {
        await parser.destroy();
      } catch (destroyError) {
        console.error("PDF 파서 정리 중 오류:", destroyError);
      }
    }
  }
}
