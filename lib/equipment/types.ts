/**
 * 장비 카탈로그 업로드(자동 추출/등록) 기능에서 공통으로 쓰는 타입 정의.
 */

/** Gemini 가 카탈로그 텍스트에서 추출한 장비 1건 (equipment 테이블에 upsert 되기 전 형태) */
export interface ParsedEquipmentItem {
  category: string;
  name: string;
  price_retail: number;
  colors: string[];
  sizes: string[];
}

/** 카탈로그 추출 단계의 결과 (파싱된 항목 + 경고/오류 메시지) */
export interface CatalogExtractionResult {
  items: ParsedEquipmentItem[];
  /** 청크 단위 처리 중 일부만 실패했을 때의 경고 메시지 목록 (전체 실패는 아님) */
  warnings: string[];
}

/** equipment 테이블 upsert 결과, 항목 1건에 대한 처리 상태 */
export type EquipmentImportItemStatus = "inserted" | "updated" | "failed";

export interface EquipmentImportItemResult {
  name: string;
  category: string;
  status: EquipmentImportItemStatus;
  message?: string;
}

/** 업로드 API 전체 응답 요약 */
export interface EquipmentImportSummary {
  brand: string;
  catalogYear: number;
  /** PDF 에서 추출을 시도한 총 페이지 수 */
  totalPages: number;
  /** Gemini 가 추출한 총 항목 수 (DB 반영 시도 이전) */
  totalParsed: number;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  items: EquipmentImportItemResult[];
  /** 추출 단계에서 발생한 경고 (일부 페이지 청크 처리 실패 등) */
  warnings: string[];
}
