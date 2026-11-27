import { partnerMovements, voucherTotals } from "@/lib/erp/compute";
import type { ErpData, PartnerKind, VoucherKind } from "@/lib/erp/types";

/**
 * 보고서 계산(경영박사 일계표·판매현황·미수/미지급·매출장/매입장·재고보고서·품목수불 대응).
 * 견적은 장부가 아니므로 어떤 보고서에도 들어가지 않는다.
 */

type Kinds = { sale: number; purchase: number; receipt: number; payment: number };
const zero = (): Kinds => ({ sale: 0, purchase: 0, receipt: 0, payment: 0 });

function addKind(k: Kinds, kind: VoucherKind, total: number) {
  if (kind === "sale") k.sale += total;
  else if (kind === "purchase") k.purchase += total;
  else if (kind === "receipt" || kind === "card_receipt") k.receipt += total;
  else if (kind === "payment") k.payment += total;
}

/** 일계표(일보) / 월보: 날짜(또는 월)별 매출·매입·입금·출금 합계 */
export function dailyReport(data: ErpData, from: string, to: string, unit: "day" | "month") {
  const rows = new Map<string, Kinds & { count: number }>();
  const total = zero();
  for (const t of voucherTotals(data).values()) {
    if (t.kind === "estimate" || t.voucher_date < from || t.voucher_date > to) continue;
    const key = unit === "day" ? t.voucher_date : t.voucher_date.slice(0, 7);
    const r = rows.get(key) ?? { ...zero(), count: 0 };
    addKind(r, t.kind, t.total);
    r.count += 1;
    rows.set(key, r);
    addKind(total, t.kind, t.total);
  }
  return {
    rows: [...rows.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, v]) => ({ key, ...v })),
    total,
  };
}

/** 판매현황: 거래처별 또는 품목별 수량·공급가·부가세·합계 */
export function salesReport(
  data: ErpData,
  from: string,
  to: string,
  kind: "sale" | "purchase",
  by: "partner" | "item"
) {
  const vById = new Map(data.vouchers.map((v) => [v.id, v]));
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const rows = new Map<string, { key: string; name: string; sub: string; count: Set<number>; qty: number; supply: number; vat: number }>();
  for (const l of data.lines) {
    const v = vById.get(l.voucher_id);
    if (!v || v.kind !== kind || v.voucher_date < from || v.voucher_date > to) continue;
    let key: string, name: string, sub: string;
    if (by === "partner") {
      key = `p${v.partner_id}`;
      name = (v.partner_id && partnerName.get(v.partner_id)) || "(거래처 없음)";
      sub = "";
    } else {
      const item = l.item_id ? itemById.get(l.item_id) : null;
      key = item ? `i${item.id}` : `d${l.description ?? ""}`;
      name = item?.name ?? l.description ?? "(품목 없음)";
      sub = item?.spec ?? "";
    }
    const r = rows.get(key) ?? { key, name, sub, count: new Set<number>(), qty: 0, supply: 0, vat: 0 };
    r.count.add(v.id);
    r.qty += l.qty;
    r.supply += l.amount;
    r.vat += l.vat;
    rows.set(key, r);
  }
  const list = [...rows.values()]
    .map((r) => ({ key: r.key, name: r.name, sub: r.sub, count: r.count.size, qty: r.qty, supply: r.supply, vat: r.vat, total: r.supply + r.vat }))
    .sort((a, b) => b.total - a.total);
  const sum = list.reduce(
    (s, r) => ({ qty: s.qty + r.qty, supply: s.supply + r.supply, vat: s.vat + r.vat, total: s.total + r.total }),
    { qty: 0, supply: 0, vat: 0, total: 0 }
  );
  return { rows: list, sum };
}

/** 미수/미지급현황: 거래처별 이월·늘어남·줄어듦·잔액(기준일까지) */
export function balanceReport(data: ErpData, from: string, to: string) {
  const moves = partnerMovements(data, voucherTotals(data));
  const rows = data.partners.map((p) => {
    let carried = Number(p.opening_balance || 0);
    let inc = 0;
    let dec = 0;
    let last: string | null = null;
    for (const m of moves.get(p.id) ?? []) {
      if (m.voucher_date > to) continue;
      if (m.voucher_date < from) carried += m.delta;
      else {
        if (m.delta > 0) inc += m.delta;
        else dec -= m.delta;
      }
      last = m.voucher_date;
    }
    return { id: p.id, name: p.name, kind: p.kind, tel: p.mobile || p.tel, carried, inc, dec, balance: carried + inc - dec, last };
  });
  const receivable = rows.filter((r) => r.balance > 0).sort((a, b) => b.balance - a.balance);
  const payable = rows.filter((r) => r.balance < 0).sort((a, b) => a.balance - b.balance);
  return { receivable, payable };
}

/**
 * 거래처별 잔액 명세(경영박사 미수/미지급현황 양식):
 * 전기이월 · 매출액 · 수금액 · 매입액 · 지급액 · 잔액을 거래처 구분별로 묶어 소계·총계를 낸다.
 * 잔액은 받을 돈(+) / 줄 돈(−) 부호 그대로.
 */
export function partnerBalanceSheet(data: ErpData, from: string, to: string) {
  const moves = partnerMovements(data, voucherTotals(data));
  const rows = data.partners.map((p) => {
    let carried = Number(p.opening_balance || 0);
    const s = { sale: 0, received: 0, purchase: 0, paid: 0 };
    for (const m of moves.get(p.id) ?? []) {
      if (m.voucher_date > to) continue;
      if (m.voucher_date < from) {
        carried += m.delta;
        continue;
      }
      if (m.kind === "sale") s.sale += m.total;
      else if (m.kind === "purchase") s.purchase += m.total;
      else if (m.kind === "payment") s.paid += m.total;
      else if (m.kind === "receipt") s.received += m.total;
      else if (m.kind === "card_receipt") {
        // 결제한 거래처에게는 수금, 카드사에게는 받을 돈이 생긴 것(매출 칸)
        if (m.delta < 0) s.received -= m.delta;
        else s.sale += m.delta;
      }
    }
    const balance = carried + s.sale - s.received - s.purchase + s.paid;
    return { id: p.id, name: p.name, kind: p.kind, tel: p.mobile || p.tel, carried, ...s, balance };
  });
  const active = rows.filter(
    (r) => r.carried !== 0 || r.sale !== 0 || r.received !== 0 || r.purchase !== 0 || r.paid !== 0 || r.balance !== 0
  );
  const order: PartnerKind[] = ["customer", "consumer", "supplier", "card", "other"];
  const groups = order
    .map((kind) => {
      const list = active.filter((r) => r.kind === kind).sort((a, b) => a.name.localeCompare(b.name, "ko"));
      return { kind, rows: list, sum: sumSheet(list) };
    })
    .filter((g) => g.rows.length > 0);
  return { groups, total: sumSheet(active), count: active.length };
}

function sumSheet(rows: { carried: number; sale: number; received: number; purchase: number; paid: number; balance: number }[]) {
  return rows.reduce(
    (s, r) => ({
      carried: s.carried + r.carried,
      sale: s.sale + r.sale,
      received: s.received + r.received,
      purchase: s.purchase + r.purchase,
      paid: s.paid + r.paid,
      balance: s.balance + r.balance,
    }),
    { carried: 0, sale: 0, received: 0, purchase: 0, paid: 0, balance: 0 }
  );
}

/** 매출장·매입장: 기간 안의 매출(매입) 전표 줄 */
export function journal(data: ErpData, from: string, to: string, kind: "sale" | "purchase") {
  const vById = new Map(data.vouchers.map((v) => [v.id, v]));
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const rows = data.lines
    .map((l) => ({ l, v: vById.get(l.voucher_id) }))
    .filter(({ v }) => v && v.kind === kind && v.voucher_date >= from && v.voucher_date <= to)
    .sort((a, b) =>
      a.v!.voucher_date === b.v!.voucher_date
        ? a.v!.voucher_no - b.v!.voucher_no || a.v!.id - b.v!.id || a.l.line_no - b.l.line_no
        : a.v!.voucher_date < b.v!.voucher_date
          ? -1
          : 1
    )
    .map(({ l, v }) => {
      const item = l.item_id ? itemById.get(l.item_id) : null;
      return {
        voucher_id: v!.id,
        date: v!.voucher_date,
        no: v!.voucher_no,
        partner: (v!.partner_id && partnerName.get(v!.partner_id)) || "",
        name: item?.name ?? l.description ?? "",
        spec: item?.spec ?? "",
        qty: l.qty,
        unit_price: l.unit_price,
        supply: l.amount,
        vat: l.vat,
        total: l.amount + l.vat,
      };
    });
  const sum = rows.reduce(
    (s, r) => ({ qty: s.qty + r.qty, supply: s.supply + r.supply, vat: s.vat + r.vat, total: s.total + r.total }),
    { qty: 0, supply: 0, vat: 0, total: 0 }
  );
  return { rows, sum };
}

/** 재고보고서: 재고관리 품목의 기초·입고·출고·현재고와 매입가 기준 재고금액 */
export function stockReport(data: ErpData, from: string, to: string) {
  const vById = new Map(data.vouchers.map((v) => [v.id, v]));
  const groupName = new Map(data.groups.map((g) => [g.id, g.name]));
  const acc = new Map<number, { before: number; inQty: number; outQty: number }>();
  for (const l of data.lines) {
    if (l.item_id == null) continue;
    const v = vById.get(l.voucher_id);
    if (!v || (v.kind !== "sale" && v.kind !== "purchase") || v.voucher_date > to) continue;
    const a = acc.get(l.item_id) ?? { before: 0, inQty: 0, outQty: 0 };
    const signed = v.kind === "purchase" ? l.qty : -l.qty;
    if (v.voucher_date < from) a.before += signed;
    else if (v.kind === "purchase") a.inQty += l.qty;
    else a.outQty += l.qty;
    acc.set(l.item_id, a);
  }
  const rows = data.items
    .filter((i) => i.track_stock)
    .map((i) => {
      const a = acc.get(i.id) ?? { before: 0, inQty: 0, outQty: 0 };
      const opening = Number(i.opening_stock || 0) + a.before;
      const stock = opening + a.inQty - a.outQty;
      return {
        id: i.id,
        name: i.name,
        spec: i.spec ?? "",
        group: i.group_id != null ? (groupName.get(i.group_id) ?? "") : "",
        unit: i.unit ?? "",
        opening,
        inQty: a.inQty,
        outQty: a.outQty,
        stock,
        cost: i.purchase_price,
        value: stock * i.purchase_price,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const sum = rows.reduce((s, r) => ({ value: s.value + r.value }), { value: 0 });
  return { rows, sum };
}

/** 품목별 원장(수불): 한 품목의 입고·출고 줄과 누적 재고 */
export function itemLedger(data: ErpData, itemId: number, from: string, to: string) {
  const item = data.items.find((i) => i.id === itemId) ?? null;
  const vById = new Map(data.vouchers.map((v) => [v.id, v]));
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const lines = data.lines
    .filter((l) => l.item_id === itemId)
    .map((l) => ({ l, v: vById.get(l.voucher_id)! }))
    .filter(({ v }) => v && (v.kind === "sale" || v.kind === "purchase") && v.voucher_date <= to)
    .sort((a, b) =>
      a.v.voucher_date === b.v.voucher_date
        ? (a.v.kind === "purchase" ? 0 : 1) - (b.v.kind === "purchase" ? 0 : 1) || a.v.id - b.v.id
        : a.v.voucher_date < b.v.voucher_date
          ? -1
          : 1
    );
  let stock = Number(item?.opening_stock || 0);
  for (const { l, v } of lines) if (v.voucher_date < from) stock += v.kind === "purchase" ? l.qty : -l.qty;
  const carried = stock;
  const rows = lines
    .filter(({ v }) => v.voucher_date >= from)
    .map(({ l, v }) => {
      stock += v.kind === "purchase" ? l.qty : -l.qty;
      return {
        voucher_id: v.id,
        date: v.voucher_date,
        kind: v.kind,
        partner: (v.partner_id && partnerName.get(v.partner_id)) || "",
        inQty: v.kind === "purchase" ? l.qty : 0,
        outQty: v.kind === "sale" ? l.qty : 0,
        unit_price: l.unit_price,
        amount: l.amount + l.vat,
        stock,
      };
    });
  const sum = rows.reduce((s, r) => ({ inQty: s.inQty + r.inQty, outQty: s.outQty + r.outQty }), { inQty: 0, outQty: 0 });
  return { item, carried, rows, sum, closing: stock };
}
