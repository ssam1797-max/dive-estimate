import type { ErpData, Item, Partner, PriceGrade, Voucher, VoucherKind } from "@/lib/erp/types";

/**
 * 파생 값 계산. DB 뷰(acct_voucher_totals / acct_partner_movements /
 * acct_partner_balances / acct_item_stock)와 같은 규칙을 따른다.
 * 1인 사업장 규모(전표 수백~수천 건)라 전체를 한 번에 읽어 계산해도 충분히 빠르다.
 */

export type VoucherTotal = Voucher & { supply: number; vat: number; total: number };

export function voucherTotals(data: ErpData): Map<number, VoucherTotal> {
  const map = new Map<number, VoucherTotal>();
  for (const v of data.vouchers) map.set(v.id, { ...v, supply: 0, vat: 0, total: 0 });
  for (const l of data.lines) {
    const t = map.get(l.voucher_id);
    if (!t) continue;
    t.supply += Number(l.amount);
    t.vat += Number(l.vat);
    t.total += Number(l.amount) + Number(l.vat);
  }
  return map;
}

/** 거래처 외상 증감. + 는 받을 돈(미수) 증가, − 는 줄 돈(미지급) 증가 쪽이다. */
export function partnerDelta(kind: VoucherKind, total: number): number {
  switch (kind) {
    case "sale":
      return total;
    case "purchase":
      return -total;
    case "receipt":
      return -total;
    case "payment":
      return total;
    case "card_receipt":
      return -total;
    default:
      return 0; // 견적은 잔액에 반영하지 않는다
  }
}

export type Movement = {
  voucher_id: number;
  voucher_date: string;
  voucher_no: number;
  kind: VoucherKind;
  delta: number;
  total: number;
  memo: string | null;
  counterpart_id: number | null;
};

export function partnerMovements(data: ErpData, totals = voucherTotals(data)): Map<number, Movement[]> {
  const map = new Map<number, Movement[]>();
  const push = (pid: number | null, m: Movement) => {
    if (pid == null) return;
    const arr = map.get(pid) ?? [];
    arr.push(m);
    map.set(pid, arr);
  };
  for (const t of totals.values()) {
    if (t.kind === "estimate") continue;
    const base = {
      voucher_id: t.id,
      voucher_date: t.voucher_date,
      voucher_no: t.voucher_no,
      kind: t.kind,
      total: t.total,
      memo: t.memo,
    };
    push(t.partner_id, { ...base, delta: partnerDelta(t.kind, t.total), counterpart_id: t.card_partner_id });
    if (t.kind === "card_receipt" && t.card_partner_id != null) {
      // 카드 결제: 고객 외상이 줄고, 그만큼 카드사에서 받을 돈이 생긴다(수수료 차감분 제외).
      push(t.card_partner_id, {
        ...base,
        delta: t.total - Number(t.card_fee || 0),
        counterpart_id: t.partner_id,
      });
    }
  }
  // 같은 날짜에서는 매출·매입을 먼저, 입금·출금을 나중에 — 그날 거래를 쌓은 뒤 결제가 빠지도록
  const rank = (k: VoucherKind) => (k === "sale" || k === "purchase" ? 0 : 1);
  for (const arr of map.values()) {
    arr.sort((a, b) =>
      a.voucher_date === b.voucher_date
        ? rank(a.kind) - rank(b.kind) || a.voucher_no - b.voucher_no || a.voucher_id - b.voucher_id
        : a.voucher_date < b.voucher_date
          ? -1
          : 1
    );
  }
  return map;
}

export type PartnerWithBalance = Partner & { balance: number; last_date: string | null };

export function partnersWithBalance(data: ErpData): PartnerWithBalance[] {
  const moves = partnerMovements(data);
  return data.partners.map((p) => {
    const arr = moves.get(p.id) ?? [];
    const balance = Number(p.opening_balance || 0) + arr.reduce((s, m) => s + m.delta, 0);
    return { ...p, balance, last_date: arr.length ? arr[arr.length - 1].voucher_date : null };
  });
}

export type ItemWithStock = Item & { stock: number | null; group_name: string | null };

export function itemsWithStock(data: ErpData): ItemWithStock[] {
  const kindById = new Map(data.vouchers.map((v) => [v.id, v.kind]));
  const net = new Map<number, number>();
  for (const l of data.lines) {
    if (l.item_id == null) continue;
    const k = kindById.get(l.voucher_id);
    const q = Number(l.qty);
    if (k === "purchase") net.set(l.item_id, (net.get(l.item_id) ?? 0) + q);
    else if (k === "sale") net.set(l.item_id, (net.get(l.item_id) ?? 0) - q);
  }
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]));
  return data.items.map((i) => ({
    ...i,
    stock: i.track_stock ? Number(i.opening_stock || 0) + (net.get(i.id) ?? 0) : null,
    group_name: i.group_id != null ? (groupName.get(i.group_id) ?? null) : null,
  }));
}

/** 기간(YYYY-MM-DD, 포함) 안의 종류별 합계 */
export function kindTotals(data: ErpData, from: string, to: string) {
  const out: Record<VoucherKind, number> = {
    sale: 0,
    purchase: 0,
    receipt: 0,
    payment: 0,
    card_receipt: 0,
    estimate: 0,
  };
  for (const t of voucherTotals(data).values()) {
    if (t.voucher_date >= from && t.voucher_date <= to) out[t.kind] += t.total;
  }
  return out;
}

/** 최근 n 개월 월별 매출·매입 합계 (오래된 달 → 최근 달) */
export function monthlySeries(data: ErpData, months: number, today: string) {
  const [y, m] = today.split("-").map(Number);
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  const rows = keys.map((k) => ({ month: k, sale: 0, purchase: 0 }));
  const idx = new Map(keys.map((k, i) => [k, i]));
  for (const t of voucherTotals(data).values()) {
    const i = idx.get(t.voucher_date.slice(0, 7));
    if (i == null) continue;
    if (t.kind === "sale") rows[i].sale += t.total;
    if (t.kind === "purchase") rows[i].purchase += t.total;
  }
  return rows;
}

/** 같은 날짜의 다음 전표번호(경영박사 dNO 와 같은 방식: 날짜별 1부터) */
export function nextVoucherNo(data: ErpData, date: string): number {
  let max = 0;
  for (const v of data.vouchers) if (v.voucher_date === date && v.voucher_no > max) max = v.voucher_no;
  return max + 1;
}

/** 등급별 판매가. B·C 가격이 비어 있으면 A 가격을 쓴다. */
export function salePriceFor(item: Pick<Item, "sale_price" | "sale_price_b" | "sale_price_c">, grade: PriceGrade | null | undefined): number {
  if (grade === "B" && item.sale_price_b != null) return Number(item.sale_price_b);
  if (grade === "C" && item.sale_price_c != null) return Number(item.sale_price_c);
  return Number(item.sale_price);
}

/** 과세 품목이면 공급가의 10%(원 단위 반올림), 면세·영세는 0 */
export function vatFor(vatType: number, amount: number): number {
  return vatType === 0 ? Math.round(amount * 0.1) : 0;
}
