/**
 * 퐁당닷컴 상품명 맨 앞에 붙는 재고/입고 안내 말머리를 다룬다.
 *
 * 퐁당닷컴은 재고 상태를 별도 필드가 아니라 상품명 앞 대괄호로 알린다(실측 예:
 * "[2026년 9월 재입고 예정] 쉬어워터 SWIFT GPS", "[예약주문] 익스페디션 더플백",
 * "[주문시 2주소요] 오르카토치 D570-GL 2.0", "[26년 입고 예정 없음] 아답터 QD-YF-S",
 * "[11월 18일 수요일 OPEN] 가민 디센트 X10"). 이 말머리는 견적 담당자에게는
 * 유용한 정보지만, 고객에게 나가는 견적서/거래명세서/엑셀에는 들어가면 안 된다.
 *
 * DB의 name 은 동기화 키((브랜드,품명))라 그대로 두고, 화면에서 이 함수로
 * "안내 문구"와 "깨끗한 품명"을 나눠 쓴다. "[노버스]플라스틱 광택제",
 * "[ 캐논 ] 80D 하우징"처럼 재고와 무관한 대괄호는 건드리지 않도록, 아래
 * 키워드가 들어간 대괄호만 안내 말머리로 본다.
 */
const STOCK_NOTE_KEYWORDS = /입고|예정|품절|예약|소요|계획|출시|발매|open/i;

/** 맨 앞의 대괄호 하나(앞뒤 공백 포함). 전각 대괄호도 함께 받는다. */
const LEADING_BRACKET = /^\s*[[［]([^\]］]*)[\]］]\s*/;

export interface SplitStockNote {
  /** 안내 말머리를 뗀 품명. 말머리가 없으면 원래 품명(앞뒤 공백 제거) 그대로. */
  displayName: string;
  /** 대괄호 안 안내 문구(예: "2026년 9월 재입고 예정"). 없으면 null. */
  note: string | null;
}

export function splitStockNote(rawName: string): SplitStockNote {
  const name = (rawName ?? "").trim();
  const match = name.match(LEADING_BRACKET);
  if (!match) return { displayName: name, note: null };

  const inner = match[1].replace(/\s+/g, " ").trim();
  if (!inner || !STOCK_NOTE_KEYWORDS.test(inner)) return { displayName: name, note: null };

  const rest = name.slice(match[0].length).trim();
  // 말머리만 있고 품명이 비는 경우는 원래 이름을 그대로 둔다(빈 품명 방지).
  if (!rest) return { displayName: name, note: null };
  return { displayName: rest, note: inner };
}

/** 고객용 출력물(견적서/거래명세서/엑셀)에 쓰는 품명 — 재고 안내 말머리를 뗀다. */
export function stripStockNote(rawName: string): string {
  return splitStockNote(rawName).displayName;
}

export interface PongdangStockStatus {
  /** 퐁당닷컴 목록에서 사라져 품절로 처리된 품목이면 true. */
  soldOut: boolean;
  /** 상품명 말머리에서 뽑은 재고/입고 안내(품절 처리된 품목이면 품절 당시 표기). */
  note: string | null;
}

export function getPongdangStockStatus(item: {
  name: string;
  is_sold_out?: boolean | null;
}): PongdangStockStatus {
  return { soldOut: Boolean(item.is_sold_out), note: splitStockNote(item.name).note };
}

export function hasPongdangStockInfo(status: PongdangStockStatus): boolean {
  return status.soldOut || status.note !== null;
}
