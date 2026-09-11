import { z } from "zod";

/**
 * Gemini 의 구조화 JSON 응답을 검증하기 위한 zod 스키마.
 * 장비 마스터 테이블(equipment)의 컬럼 요구사항과 1:1로 대응한다.
 */
export const parsedEquipmentItemSchema = z.object({
  category: z
    .string()
    .trim()
    .min(1, "category 는 비어 있을 수 없습니다."),
  name: z.string().trim().min(1, "name 은 비어 있을 수 없습니다."),
  price_retail: z
    .number()
    .finite("price_retail 은 유한한 숫자여야 합니다.")
    .min(0, "price_retail 은 0 이상이어야 합니다."),
  colors: z.array(z.string().trim()).default([]),
  sizes: z.array(z.string().trim()).default([]),
});

export const parsedEquipmentListSchema = z.object({
  items: z.array(parsedEquipmentItemSchema),
});

export type ParsedEquipmentItemInput = z.infer<typeof parsedEquipmentItemSchema>;

/** 업로드 폼(요청) 검증용 스키마 */
export const equipmentImportRequestSchema = z.object({
  brand: z.string().trim().min(1, "브랜드를 입력해주세요."),
  catalogYear: z
    .number()
    .int("발행 연도는 정수여야 합니다.")
    .min(1990, "발행 연도가 올바르지 않습니다.")
    .max(2100, "발행 연도가 올바르지 않습니다."),
});

/** 장비 수동 등록 API 요청 검증 스키마 */
export const equipmentCreateSchema = z.object({
  brand: z.string().trim().min(1, "브랜드를 입력해주세요."),
  category: z.string().trim().min(1, "카테고리를 선택하거나 입력해주세요."),
  name: z.string().trim().min(1, "모델명을 입력해주세요."),
  price_retail: z
    .number()
    .finite("소비자 가격은 숫자여야 합니다.")
    .min(0, "소비자 가격은 0 이상이어야 합니다."),
  colors: z.array(z.string().trim().min(1)).default([]),
  sizes: z.array(z.string().trim().min(1)).default([]),
  catalog_year: z
    .number()
    .int("발행 연도는 정수여야 합니다.")
    .min(1990, "발행 연도가 올바르지 않습니다.")
    .max(2100, "발행 연도가 올바르지 않습니다.")
    .nullable()
    .optional(),
});

export type EquipmentCreateInput = z.infer<typeof equipmentCreateSchema>;

/** 장비 수정 API(PUT) 요청 검증 스키마 — 생성 스키마와 동일한 전체 필드를 그대로 덮어쓴다. */
export const equipmentUpdateSchema = equipmentCreateSchema;

export type EquipmentUpdateInput = z.infer<typeof equipmentUpdateSchema>;
