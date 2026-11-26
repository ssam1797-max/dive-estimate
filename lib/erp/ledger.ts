import { partnerMovements, voucherTotals } from "@/lib/erp/compute";
import type { ErpData } from "@/lib/erp/types";

export type LedgerRow = {
  voucher_id: number;
  voucher_date: string;
  voucher_no: number;
  kind: string;
  summary: string;
  increase: number; // 잔액 증가(매출·출금 등)
  decrease: number; // 잔액 감소(매입·입금 등)
  balance: number;
};

/** 거래처원장: 기간 이전 잔액(이월) + 기간 내 거래 + 누적 잔액 */
export function partnerLedger(data: ErpData, partnerId: number, from: string, to: string) {
  const partner = data.partners.find((p) => p.id === partnerId);
  const totals = voucherTotals(data);
  const moves = partnerMovements(data, totals).get(partnerId) ?? [];
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const linesBy = new Map<number, string[]>();
  for (const l of data.lines) {
    const arr = linesBy.get(l.voucher_id) ?? [];
    arr.push((l.item_id ? itemName.get(l.item_id) : null) ?? l.description ?? "");
    linesBy.set(l.voucher_id, arr);
  }

  let carried = Number(partner?.opening_balance ?? 0);
  for (const m of moves) if (m.voucher_date < from) carried += m.delta;

  let bal = carried;
  const rows: LedgerRow[] = [];
  for (const m of moves) {
    if (m.voucher_date < from || m.voucher_date > to) continue;
    bal += m.delta;
    const names = (linesBy.get(m.voucher_id) ?? []).filter(Boolean);
    let summary = names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : (names[0] ?? "");
    if (m.kind === "card_receipt") {
      const other = m.counterpart_id ? partnerName.get(m.counterpart_id) : "";
      summary = `카드결제${other ? ` (${other})` : ""}`;
    }
    if (m.memo && !summary.includes(m.memo)) summary = summary ? `${summary} · ${m.memo}` : m.memo;
    rows.push({
      voucher_id: m.voucher_id,
      voucher_date: m.voucher_date,
      voucher_no: m.voucher_no,
      kind: m.kind,
      summary,
      increase: m.delta > 0 ? m.delta : 0,
      decrease: m.delta < 0 ? -m.delta : 0,
      balance: bal,
    });
  }
  const sumInc = rows.reduce((s, r) => s + r.increase, 0);
  const sumDec = rows.reduce((s, r) => s + r.decrease, 0);
  return { partner, carried, rows, sumInc, sumDec, closing: bal };
}
