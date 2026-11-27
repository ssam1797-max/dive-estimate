import { partnerMovements, voucherTotals } from "@/lib/erp/compute";
import { VOUCHER_KIND_LABEL, type ErpData } from "@/lib/erp/types";

export type LedgerDetail = { name: string; qty: number; unit_price: number; amount: number };

export type LedgerRow = {
  voucher_id: number;
  voucher_date: string;
  voucher_no: number;
  kind: string;
  summary: string;
  increase: number; // 잔액 증가(매출·출금 등)
  decrease: number; // 잔액 감소(매입·입금 등)
  balance: number;
  /** 매출·매입 전표의 품목 줄(부가세 포함 금액) */
  details: LedgerDetail[];
};

/** 거래처원장: 기간 이전 잔액(이월) + 기간 내 거래 + 누적 잔액 */
export function partnerLedger(data: ErpData, partnerId: number, from: string, to: string) {
  const partner = data.partners.find((p) => p.id === partnerId);
  const totals = voucherTotals(data);
  const moves = partnerMovements(data, totals).get(partnerId) ?? [];
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const linesBy = new Map<number, string[]>();
  const detailsBy = new Map<number, LedgerDetail[]>();
  for (const l of [...data.lines].sort((a, b) => a.line_no - b.line_no)) {
    const name = (l.item_id ? itemName.get(l.item_id) : null) ?? l.description ?? "";
    const arr = linesBy.get(l.voucher_id) ?? [];
    arr.push(name);
    linesBy.set(l.voucher_id, arr);
    if (l.item_id != null || l.qty) {
      const d = detailsBy.get(l.voucher_id) ?? [];
      d.push({
        name: l.item_id && l.description ? `${name} (${l.description})` : name,
        qty: l.qty,
        unit_price: l.unit_price,
        amount: l.amount + l.vat,
      });
      detailsBy.set(l.voucher_id, d);
    }
  }

  let carried = Number(partner?.opening_balance ?? 0);
  for (const m of moves) if (m.voucher_date < from) carried += m.delta;

  let bal = carried;
  const rows: LedgerRow[] = [];
  for (const m of moves) {
    if (m.voucher_date < from || m.voucher_date > to) continue;
    bal += m.delta;
    // 경영박사에서 옮겨온 입금·출금은 품목·적요 없이 금액만 있어 이름이 빈칸일 수 있다
    const names = (linesBy.get(m.voucher_id) ?? []).filter((n) => n.trim() !== "");
    let summary = names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : (names[0] ?? "");
    if (m.kind === "card_receipt") {
      const other = m.counterpart_id ? partnerName.get(m.counterpart_id) : "";
      summary = `카드결제${other ? ` (${other})` : ""}`;
    }
    if (m.memo && !summary.includes(m.memo)) summary = summary ? `${summary} · ${m.memo}` : m.memo;
    if (!summary) summary = m.kind === "receipt" ? "입금받음" : m.kind === "payment" ? "지급함" : VOUCHER_KIND_LABEL[m.kind];
    rows.push({
      voucher_id: m.voucher_id,
      voucher_date: m.voucher_date,
      voucher_no: m.voucher_no,
      kind: m.kind,
      summary,
      increase: m.delta > 0 ? m.delta : 0,
      decrease: m.delta < 0 ? -m.delta : 0,
      balance: bal,
      details: m.kind === "sale" || m.kind === "purchase" ? (detailsBy.get(m.voucher_id) ?? []) : [],
    });
  }
  const sumInc = rows.reduce((s, r) => s + r.increase, 0);
  const sumDec = rows.reduce((s, r) => s + r.decrease, 0);
  const sumBy = (k: string) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.increase + r.decrease, 0);
  const byKind = {
    sale: sumBy("sale"),
    purchase: sumBy("purchase"),
    receipt: sumBy("receipt") + sumBy("card_receipt"),
    payment: sumBy("payment"),
  };
  return { partner, carried, rows, sumInc, sumDec, closing: bal, byKind };
}

/** 이 전표 직전과 직후의 거래처 잔액(거래명세서 하단 표시용) */
export function balanceAroundVoucher(data: ErpData, voucherId: number) {
  const v = data.vouchers.find((x) => x.id === voucherId);
  if (!v || v.partner_id == null) return null;
  const partner = data.partners.find((p) => p.id === v.partner_id);
  const moves = partnerMovements(data, voucherTotals(data)).get(v.partner_id) ?? [];
  let before = Number(partner?.opening_balance ?? 0);
  let self = 0;
  for (const m of moves) {
    if (m.voucher_id === voucherId) {
      self = m.delta;
      break;
    }
    before += m.delta;
  }
  const current = Number(partner?.opening_balance ?? 0) + moves.reduce((s, m) => s + m.delta, 0);
  return { before, self, after: before + self, current };
}
