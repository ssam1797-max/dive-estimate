/**
 * 색상/사이즈 옵션을 어떤 값으로 저장할지 정하는 순수 함수들.
 *
 * 옵션의 출처는 두 가지다.
 * - 목록 페이지: 동기화 때마다 받지만 첫 옵션 1개만 보이는 경우가 많다.
 * - 상세페이지: 옵션 전체가 보이지만 품목당 요청이 1번 더 든다.
 *
 * 그래서 상세페이지로 확인한 옵션은 목록 페이지 값이 덮어쓰면 안 된다.
 */

export const NO_OPTION_LABEL = "기본";

export interface EquipmentOptions {
  colors: string[];
  sizes: string[];
}

export interface StoredEquipmentOptions extends EquipmentOptions {
  option_checked_at?: string | null;
}

export type DetailOptionAxis = "color" | "size" | null;

function realColors(colors: string[]): string[] {
  return colors.filter((color) => color !== NO_OPTION_LABEL);
}

function hasRealOptions(options: EquipmentOptions): boolean {
  return realColors(options.colors).length > 0 || options.sizes.length > 0;
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "ko"));
}

/**
 * 동기화에서 받은 목록 페이지 옵션(listed)과 저장된 옵션(stored) 중 저장할
 * 값을 고른다. 상세페이지로 확인했고 실제 옵션이 있으면 저장된 값을 유지한다.
 * 목록 값과 합치지 않는 이유는 표기가 달라서("S" / "250-260(S)") 같은 옵션이
 * 두 번 보이게 되기 때문이다. 새로 나온 옵션은 주기적 재확인에서 반영된다.
 */
export function mergeListedOptions(
  stored: StoredEquipmentOptions | undefined,
  listed: EquipmentOptions
): EquipmentOptions {
  if (stored?.option_checked_at && hasRealOptions(stored)) {
    return { colors: stored.colors, sizes: stored.sizes };
  }
  return listed;
}

/**
 * 상세페이지에서 읽은 옵션을 저장된 옵션에 반영한다. 읽은 축(색상 또는
 * 사이즈)은 통째로 교체해서 사라진 옵션도 함께 빠지게 하고, 다른 축은
 * 그대로 둔다. 옵션을 읽지 못했으면(단일 상품, 렌즈 도수 등 다른 축)
 * 저장된 값을 유지한다.
 */
export function applyDetailOptions(
  stored: EquipmentOptions,
  axis: DetailOptionAxis,
  labels: string[]
): EquipmentOptions {
  if (axis === null || labels.length === 0) return stored;

  if (axis === "color") {
    return { colors: sortedUnique(labels), sizes: stored.sizes };
  }
  return { colors: realColors(stored.colors), sizes: sortedUnique(labels) };
}
