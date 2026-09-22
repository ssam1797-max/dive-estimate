import { z } from "zod";
// 참고: zod의 z.enum()은 튜플 리터럴 타입이 필요해 PRICE_TIERS(PriceTier[])를 바로 넣을 수 없으므로
// 아래 exportEstimateSchema에서는 값을 직접 나열합니다. (PriceTier 값과 항상 동일하게 유지)

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/** 공급자/공급받는자 프로필 생성·수정 요청 검증 스키마 */
export const profileSchema = z.object({
  type: z.enum(["PROVIDER", "RECEIVER"], { message: "구분(공급자/공급받는자)을 선택해주세요." }),
  name: z.string().trim().min(1, "상호(이름)를 입력해주세요."),
  contact: z.string().trim().default(""),
  address: z.string().trim().default(""),
  // 파일 업로드 시 base64 data URI 문자열이 그대로 들어온다 (예: 1.5MB 이미지 -> 약 2MB 문자열).
  stampUrl: z.string().trim().max(3_000_000, "도장 이미지 파일이 너무 큽니다.").default(""),
  businessNumber: z.string().trim().default(""),
  representative: z.string().trim().default(""),
  businessType: z.string().trim().default(""),
  businessCategory: z.string().trim().default(""),
  email: z.string().trim().default(""),
  fax: z.string().trim().default(""),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const saveEstimateItemSchema = z.object({
  equipmentId: z.string().uuid().nullable(),
  // equipment 마스터 조인이 아니라 항목 자체에 품명/브랜드/카테고리를 그대로
  // 저장한다 — 품명 수동 수정 및 퐁당닷컴 검색 없이 직접 추가한 품목(
  // equipmentId=null) 을 지원하기 위함.
  name: z.string().trim().default(""),
  brand: z.string().trim().default(""),
  category: z.string().trim().default(""),
  color: z.string().trim().default(""),
  size: z.string().trim().default(""),
  quantity: z.number().int("수량은 정수여야 합니다.").min(1, "수량은 1개 이상이어야 합니다."),
  unitPrice: z.number().min(0, "단가는 0 이상이어야 합니다."),
  itemRemarks: z.string().trim().default(""),
  // 저장 시점 4개 가격 등급 단가 스냅샷 (상세/인쇄 화면 탭 전환용). 템플릿
  // 저장 등 일부 경로에서는 생략될 수 있어 선택 필드로 둔다.
  priceRetail: z.number().min(0).optional(),
  priceInstructor: z.number().min(0).optional(),
  priceCenter: z.number().min(0).optional(),
  priceCost: z.number().min(0).optional(),
});

/** 실제 견적서 저장 요청 검증 스키마 */
export const saveRealEstimateSchema = z.object({
  estimateNumber: z.string().trim().min(1, "견적서 번호가 없습니다."),
  date: z.string().regex(DATE_REGEX, "날짜 형식이 올바르지 않습니다."),
  providerId: z.string().uuid("공급자를 선택해주세요."),
  receiverId: z.string().uuid("공급받는자를 선택해주세요."),
  remarks: z.string().trim().default(""),
  priceTier: z.enum(["RETAIL", "INSTRUCTOR", "CENTER", "COST"], {
    message: "가격 등급을 선택해주세요.",
  }),
  items: z.array(saveEstimateItemSchema).min(1, "장비를 1개 이상 담아주세요."),
});

/** 템플릿 저장 요청 검증 스키마 */
export const saveTemplateSchema = z.object({
  templateName: z.string().trim().min(1, "템플릿 이름을 입력해주세요."),
  items: z.array(saveEstimateItemSchema).min(1, "장비를 1개 이상 담아주세요."),
});

/** 견적서 번호 자동 생성 API 쿼리 검증 스키마 */
export const nextEstimateNumberQuerySchema = z.object({
  date: z.string().regex(DATE_REGEX, "날짜 형식이 올바르지 않습니다."),
});

/** 엑셀 미리보기/다운로드 요청 항목 검증 스키마 (equipmentId 대신 표시용 필드를 직접 담음) */
export const exportEstimateItemSchema = z.object({
  brand: z.string().trim().min(1, "브랜드 정보가 없습니다."),
  // 카테고리는 엑셀 문서에 아예 표시되지 않고(buildEstimateWorkbook 은
  // name/spec/단위/수량/단가/금액/적요만 그린다) 서버 재계산에도 쓰이지
  // 않는다(브랜드만 할인율 조회에 쓰인다). 그런데 필수(min 1)로 묶여
  // 있어서, 카테고리를 비워둔 채 "품목 직접 추가"로 넣은 품목이 들어간
  // 견적서는 엑셀 다운로드가 "카테고리 정보가 없습니다."로 통째로 막혔다
  // — 배송비처럼 카테고리가 없는 일회성 품목이 정상적인 입력이므로
  // 선택 항목으로 되돌린다.
  category: z.string().trim().default(""),
  name: z.string().trim().min(1, "장비명 정보가 없습니다."),
  color: z.string().trim().default(""),
  size: z.string().trim().default(""),
  quantity: z.number().int("수량은 정수여야 합니다.").min(1, "수량은 1개 이상이어야 합니다."),
  priceRetail: z.number().min(0, "정가는 0 이상이어야 합니다."),
  itemRemarks: z.string().trim().default(""),
  unit: z.string().trim().optional(),
  /** 품목별 예외 할인율(%). 있으면 서버 재계산 시 브랜드 할인율보다 우선한다. */
  overrideDiscountRate: z.number().min(0).max(100).nullable().optional(),
});

/** 엑셀 미리보기/다운로드(POST /api/estimates/export) 요청 검증 스키마 */
export const exportEstimateSchema = z.object({
  estimateNumber: z.string().trim().min(1, "견적서 번호가 없습니다."),
  date: z.string().regex(DATE_REGEX, "날짜 형식이 올바르지 않습니다."),
  providerId: z.string().uuid("공급자를 선택해주세요."),
  receiverId: z.string().uuid("공급받는자를 선택해주세요."),
  remarks: z.string().trim().default(""),
  priceTier: z.enum(["RETAIL", "INSTRUCTOR", "CENTER", "COST"], {
    message: "가격 버전을 선택해주세요.",
  }),
  /** 참고용으로 문서에 함께 노출할 등급들(0~4개). 총액 계산에는 관여하지 않는다. */
  referenceTiers: z.array(z.enum(["RETAIL", "INSTRUCTOR", "CENTER", "COST"])).default([]),
  items: z.array(exportEstimateItemSchema).min(1, "장비를 1개 이상 담아주세요."),
});

export type ExportEstimateInput = z.infer<typeof exportEstimateSchema>;
