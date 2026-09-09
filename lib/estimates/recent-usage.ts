/**
 * 견적서 작성 화면에서 최근 사용한 브랜드/카테고리/장비를 브라우저
 * localStorage 에 기록해, 장비 선택 드롭다운에서 최상단에 노출하기 위한
 * 유틸리티. 서버에는 아무것도 저장하지 않으며(요청사항의 "(선택)" 옵션 중
 * 로컬 스토리지 방식을 채택), 다른 저장 로직(4개 가격 등급 스냅샷 등)에는
 * 전혀 관여하지 않는다.
 *
 * localStorage 는 React 바깥의 "외부 스토어"이므로, 여기서는
 * useSyncExternalStore 와 함께 쓰도록 구독(subscribe)/스냅샷(getSnapshot)
 * 형태로 노출한다(useEffect 안에서 setState 하는 방식은 불필요한 재렌더링을
 * 유발해 지양한다).
 */

export interface RecentUsageEntry {
  brand: string;
  category: string;
  equipmentId: string;
  usedAt: number;
}

const STORAGE_KEY = "dive-estimate:recent-equipment-usage";
const MAX_ENTRIES = 50;
const EMPTY: RecentUsageEntry[] = [];

let cachedEntries: RecentUsageEntry[] | null = null;
const listeners = new Set<() => void>();

function readEntriesFromStorage(): RecentUsageEntry[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return parsed.filter(
      (entry): entry is RecentUsageEntry =>
        entry &&
        typeof entry.brand === "string" &&
        typeof entry.category === "string" &&
        typeof entry.equipmentId === "string" &&
        typeof entry.usedAt === "number"
    );
  } catch {
    return EMPTY;
  }
}

function getCachedEntries(): RecentUsageEntry[] {
  if (cachedEntries === null) {
    cachedEntries = readEntriesFromStorage();
  }
  return cachedEntries;
}

function setCachedEntries(entries: RecentUsageEntry[]): void {
  cachedEntries = entries;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // 저장 실패(용량 초과, 프라이빗 모드 등)는 정렬 기능만 못 쓸 뿐 조용히 무시한다.
    }
  }
  listeners.forEach((listener) => listener());
}

/** useSyncExternalStore 의 subscribe 인자. */
export function subscribeRecentUsage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** useSyncExternalStore 의 getSnapshot 인자 — 값이 안 바뀌면 같은 참조를 반환한다. */
export function getRecentUsageSnapshot(): RecentUsageEntry[] {
  return getCachedEntries();
}

/** useSyncExternalStore 의 getServerSnapshot 인자 — 서버에는 기록이 없다. */
export function getRecentUsageServerSnapshot(): RecentUsageEntry[] {
  return EMPTY;
}

/** 장비를 견적에 담을 때 호출 — 최근 사용 목록 맨 앞으로 이동시킨다. */
export function recordEquipmentUsage(usage: {
  brand: string;
  category: string;
  equipmentId: string;
}): void {
  const entries = getCachedEntries().filter((e) => e.equipmentId !== usage.equipmentId);
  entries.unshift({ ...usage, usedAt: Date.now() });
  setCachedEntries(entries.slice(0, MAX_ENTRIES));
}

/** 기록된 순서(최근 사용 순) 그대로 고유한 값을 뽑아낸다. */
function uniqueInOrder<T>(values: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const v of values) {
    if (!seen.has(v)) {
      seen.add(v);
      result.push(v);
    }
  }
  return result;
}

export function getRecentBrands(entries: RecentUsageEntry[]): string[] {
  return uniqueInOrder(entries.map((e) => e.brand));
}

export function getRecentCategories(entries: RecentUsageEntry[], brand: string): string[] {
  return uniqueInOrder(entries.filter((e) => e.brand === brand).map((e) => e.category));
}

export function getRecentEquipmentIds(
  entries: RecentUsageEntry[],
  brand: string,
  category: string
): string[] {
  return uniqueInOrder(
    entries.filter((e) => e.brand === brand && e.category === category).map((e) => e.equipmentId)
  );
}

/**
 * 기존 옵션 목록(알파벳/가나다순)을 그대로 두되, recentKeysInOrder 에 있는
 * 항목만 최근 사용 순으로 맨 위에 올린다. recentKeysInOrder 에 없는 항목은
 * 원래 순서를 유지한 채 그 뒤에 이어붙인다.
 */
export function sortWithRecentFirst<T>(
  options: T[],
  recentKeysInOrder: string[],
  keyOf: (option: T) => string
): T[] {
  if (recentKeysInOrder.length === 0) return options;
  const byKey = new Map(options.map((option) => [keyOf(option), option]));
  const recentFirst: T[] = [];
  for (const key of recentKeysInOrder) {
    const option = byKey.get(key);
    if (option) {
      recentFirst.push(option);
      byKey.delete(key);
    }
  }
  const rest = options.filter((option) => byKey.has(keyOf(option)));
  return [...recentFirst, ...rest];
}
