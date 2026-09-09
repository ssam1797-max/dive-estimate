/**
 * 견적서 작성 화면에서 공통으로 쓰는 타입 정의.
 */
import type { PriceTier } from "@/lib/estimates/pricing";

/** 3단계 장비 선택(브랜드 → 카테고리 → 장비명)의 원본 데이터 1건 */
export interface EquipmentCatalogItem {
  id: string;
  brand: string;
  category: string;
  name: string;
  price_retail: number;
  colors: string[];
  sizes: string[];
}

/** 공급자/수신자 드롭다운에 쓰는 프로필 옵션 (엑셀 미리보기/다운로드에 필요한 주소·도장 이미지 포함) */
export interface ProfileOption {
  id: string;
  name: string;           // 상호
  contact: string | null; // 전화
  address?: string | null;
  stampUrl?: string | null;
  // 관공서 납품용 견적서 공급자 정보
  businessNumber?: string | null; // 사업자번호
  representative?: string | null; // 대표자
  businessType?: string | null;   // 업태
  businessCategory?: string | null; // 종목
  email?: string | null;
}

/** 견적 테이블에 담긴 항목 1건 (클라이언트 상태) */
export interface EstimateItemDraft {
  /** DB 저장 전 React key/삭제용 클라이언트 임시 id (DB의 estimate_items.id 아님) */
  clientId: string;
  equipmentId: string;
  brand: string;
  category: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  /** 소비자 정가 — 가격 탭 전환 시 재계산의 기준값. 변경하지 말 것. */
  priceRetail: number;
  /** 현재 적용 단가 (가격 탭 전환 시 재계산, 수동 편집 가능) */
  unitPrice: number;
  itemRemarks: string;
}

/** 저장된 템플릿 요약 (불러오기 목록용) */
export interface TemplateSummary {
  id: string;
  templateName: string;
  itemCount: number;
  updatedAt: string;
}

/** 템플릿 상세 (항목 포함, 불러오기 시 사용) */
export interface TemplateDetail extends TemplateSummary {
  items: EstimateItemDraft[];
}

/** 저장 API 요청 바디에 실리는 항목 형태 */
export interface SaveEstimateItemPayload {
  equipmentId: string | null;
  color: string;
  size: string;
  quantity: number;
  unitPrice: number;
  itemRemarks: string;
  /**
   * 저장 시점 4개 가격 등급 단가 스냅샷 — 상세/인쇄 화면에서 등급 탭을
   * 전환해도 볼 수 있도록 저장 순간의 실제 적용 단가를 그대로 보존한다
   * (나중에 브랜드 할인율 정책이 바뀌어도 과거 견적서 금액은 안 바뀜).
   * 템플릿 저장 시에도 함께 채워지지만 필수는 아니다.
   */
  priceRetail?: number;
  priceInstructor?: number;
  priceCenter?: number;
  priceCost?: number;
}

export interface SaveEstimateResult {
  id: string;
}

/** 엑셀 미리보기/다운로드 요청에 실리는 항목 형태 (표시에 필요한 필드를 그대로 포함) */
export interface ExportEstimateItemPayload {
  brand: string;
  category: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  /** 서버에서 티어 할인 재계산의 기준이 되는 소비자 정가 */
  priceRetail: number;
  itemRemarks: string;
  /** 단위 (기본: "개") */
  unit?: string;
}

/** 엑셀 다운로드(POST /api/estimates/export) 요청 바디 */
export interface ExportEstimatePayload {
  date: string;
  estimateNumber: string;
  providerId: string;
  receiverId: string;
  remarks: string;
  priceTier: string;
  items: ExportEstimateItemPayload[];
}

/** 견적서 보관함 목록 1건 (실제 저장된 견적서 — 템플릿 제외) */
export interface SavedEstimateSummary {
  id: string;
  estimateNumber: string;
  date: string;
  providerName: string;
  receiverName: string;
  itemCount: number;
  /** 저장 시점 선택되어 있던 등급의 합계(레거시 호환용 — totalsByTier 폴백에도 쓰임). */
  totalAmount: number;
  /**
   * 4개 가격 등급별 합계(품목별 단가 스냅샷 × 수량의 합). 보관함 목록 화면의
   * 등급 탭 전환에 쓰인다. 이 기능 추가 이전에 저장된 견적서(스냅샷 없음)는
   * 4개 등급 모두 totalAmount 로 폴백된다.
   */
  totalsByTier: Record<PriceTier, number>;
  createdAt: string;
}

/** 견적서 보관함 상세 조회 시 항목 1건 */
export interface SavedEstimateItemDetail {
  /** 원본 장비 마스터 ID ("이어서 수정" 시 재사용). 장비가 삭제됐으면 null. */
  equipmentId: string | null;
  brand: string;
  category: string;
  name: string;
  color: string;
  size: string;
  quantity: number;
  /** 저장 시점 선택되어 있던 등급의 단가(레거시 호환용 — 목록 합계 등에 사용). */
  unitPrice: number;
  itemRemarks: string;
  /**
   * 저장 시점 4개 가격 등급 단가 스냅샷. 이 컬럼이 추가되기 전에 저장된
   * 견적서는 null이며, 이 경우 화면에서 unitPrice 로 폴백해서 표시한다.
   */
  priceRetail: number | null;
  priceInstructor: number | null;
  priceCenter: number | null;
  priceCost: number | null;
}

/** 견적서 보관함 상세 (목록에서 특정 견적서를 열었을 때) */
export interface SavedEstimateDetail extends SavedEstimateSummary {
  remarks: string;
  items: SavedEstimateItemDetail[];
  /** 인쇄용 문서(사업번호/주소/도장 등)를 그리기 위한 전체 프로필. 삭제된 프로필이면 null. */
  provider: ProfileOption | null;
  receiver: ProfileOption | null;
  /** 저장 시점 선택되어 있던 가격 등급 — 상세/인쇄 화면의 초기 탭. 이전 형식 견적서는 null. */
  priceTier: PriceTier | null;
}
