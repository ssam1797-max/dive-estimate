/**
 * 퐁당닷컴 옵션별 품절 정보. 서버(옵션 보완 작업)와 브라우저(견적 화면의
 * 색상/사이즈 선택) 양쪽에서 쓰는 순수 함수만 둔다.
 *
 * 품절 옵션도 견적에는 담을 수 있어야 하므로(주문은 따로 확인) 옵션 목록
 * 자체(equipment.colors/sizes)에서는 빼지 않고, 품절 여부만 따로 저장한다.
 *
 * - colors: 모든 사이즈가 품절인 색상(또는 색상만 있는 상품의 품절 색상)
 * - sizes: 모든 색상에서 품절인 사이즈(또는 사이즈만 있는 상품의 품절 사이즈)
 * - combos: 특정 색상의 특정 사이즈만 품절인 조합(comboKey 로 만든 문자열)
 */

export interface OptionSoldOut {
  colors: string[];
  sizes: string[];
  combos: string[];
}

export const EMPTY_OPTION_SOLD_OUT: OptionSoldOut = { colors: [], sizes: [], combos: [] };

const COMBO_SEPARATOR = "\t";

export function comboKey(color: string, size: string): string {
  return `${color}${COMBO_SEPARATOR}${size}`;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** DB(jsonb)에서 읽은 값을 안전하게 OptionSoldOut 으로 바꾼다. */
export function normalizeOptionSoldOut(raw: unknown): OptionSoldOut {
  if (!raw || typeof raw !== "object") return EMPTY_OPTION_SOLD_OUT;
  const obj = raw as Record<string, unknown>;
  return {
    colors: toStringArray(obj.colors),
    sizes: toStringArray(obj.sizes),
    combos: toStringArray(obj.combos),
  };
}

export function isColorSoldOut(soldOut: OptionSoldOut | undefined, color: string): boolean {
  return Boolean(soldOut?.colors.includes(color));
}

/** 색상을 이미 골랐으면 그 색상 기준으로, 아니면 모든 색상에서 품절인지 본다. */
export function isSizeSoldOut(
  soldOut: OptionSoldOut | undefined,
  size: string,
  color?: string
): boolean {
  if (!soldOut) return false;
  if (soldOut.sizes.includes(size)) return true;
  if (color && soldOut.colors.includes(color)) return true;
  return Boolean(color && soldOut.combos.includes(comboKey(color, size)));
}

/** 드롭다운에 보여줄 옵션 이름. 저장되는 값에는 붙이지 않는다. */
export function withSoldOutMark(label: string, soldOut: boolean): string {
  return soldOut ? `${label} (품절)` : label;
}
