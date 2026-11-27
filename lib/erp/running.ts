import { partnerDelta, partnerMovements, voucherTotals } from "@/lib/erp/compute";
import type { ErpData, VoucherKind } from "@/lib/erp/types";

/**
 * 거래처별 "전표 줄 단위" 누적 잔액 — 경영박사 전표 화면처럼
 * 위(오래된 것)부터 매출·매입 품목 줄마다 잔액이 쌓이고, 입금·출금 줄에서 빠진다.
 * 잔액 부호: + 받을 돈(미수), − 줄 돈(미지급).
 */
export type RunningRow = {
  voucher_id: number;
  voucher_date: string;
  voucher_no: number;
  kind: VoucherKind;
  /** 같은 전표의 첫 줄인지(날짜·종류를 첫 줄에만 보여줄 때) */
  first: boolean;
  name: string;
  spec: string | null;
  /** 경영박사 원장 칸: out = 매출/출금, in = 매입/입금 */
  col: "out" | "in";
  /** 같은 전표의 줄 수(2줄 이상이면 건계를 붙인다) */
  lineCount: number;
  qty: number | null;
  unit_price: number | null;
  supply: number;
  vat: number;
  total: number;
  /** 이 줄이 잔액에 더한 값(+/−) */
  delta: number;
  balance: number;
};

export function partnerRunning(data: ErpData, partnerId: number, from: string, to: string) {
  const partner = data.partners.find((p) => p.id === partnerId);
  const totals = voucherTotals(data);
  const moves = partnerMovements(data, totals).get(partnerId) ?? [];
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const itemSpec = new Map(data.items.map((i) => [i.id, i.spec]));
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const linesBy = new Map<number, typeof data.lines>();
  for (const l of [...data.lines].sort((a, b) => a.line_no - b.line_no)) {
    const arr = linesBy.get(l.voucher_id) ?? [];
    arr.push(l);
    linesBy.set(l.voucher_id, arr);
  }

  let balance = Number(partner?.opening_balance ?? 0);
  for (const m of moves) if (m.voucher_date < from) balance += m.delta;
  const carried = balance;

  const rows: RunningRow[] = [];
  for (const m of moves) {
    if (m.voucher_date < from || m.voucher_date > to) continue;
    const base = { voucher_id: m.voucher_id, voucher_date: m.voucher_date, voucher_no: m.voucher_no, kind: m.kind };
    const lines = linesBy.get(m.voucher_id) ?? [];
    const sign = Math.sign(partnerDelta(m.kind, 1)) || 1;
    // 카드사 쪽에서 본 카드입금(수수료 차감 금액이 잡힌다)이나 줄이 없는 전표는 한 줄로 보여준다
    const isCardSide = m.kind === "card_receipt" && m.counterpart_id != null && totals.get(m.voucher_id)?.partner_id !== partnerId;
    const col: "out" | "in" = m.kind === "sale" || m.kind === "payment" || isCardSide ? "out" : "in";
    if (isCardSide || lines.length === 0) {
      balance += m.delta;
      const other = m.counterpart_id ? partnerName.get(m.counterpart_id) : null;
      rows.push({
        ...base,
        first: true,
        spec: null,
        col,
        lineCount: 1,
        name: isCardSide ? `카드결제${other ? ` (${other})` : ""}` : (m.memo ?? kindWord(m.kind)),
        qty: null,
        unit_price: null,
        supply: Math.abs(m.delta),
        vat: 0,
        total: Math.abs(m.delta),
        delta: m.delta,
        balance,
      });
      continue;
    }
    lines.forEach((l, i) => {
      const total = l.amount + l.vat;
      const delta = sign * total;
      balance += delta;
      const itemized = l.item_id != null || (l.qty !== 0 && m.kind !== "receipt" && m.kind !== "payment");
      let name = (l.item_id ? itemName.get(l.item_id) : null) ?? l.description ?? "";
      if (l.item_id && l.description) name = `${name} (${l.description})`;
      if (!name.trim()) name = m.memo ?? kindWord(m.kind);
      rows.push({
        ...base,
        first: i === 0,
        name,
        spec: l.item_id ? (itemSpec.get(l.item_id) ?? null) : null,
        col,
        lineCount: lines.length,
        qty: itemized ? l.qty : null,
        unit_price: itemized ? l.unit_price : null,
        supply: l.amount,
        vat: l.vat,
        total,
        delta,
        balance,
      });
    });
  }
  return { partner, carried, rows, closing: balance };
}

function kindWord(kind: VoucherKind): string {
  switch (kind) {
    case "receipt":
      return "입금";
    case "payment":
      return "출금";
    case "card_receipt":
      return "카드입금";
    default:
      return "";
  }
}
