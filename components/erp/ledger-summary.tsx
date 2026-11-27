import { formatWon } from "@/lib/erp/format";

/** 거래처원장 위쪽 요약: 이월 · 매출 · 매입 · 입금 · 출금 · 최종 잔액 */
export function LedgerSummary({
  carried,
  byKind,
  closing,
}: {
  carried: number;
  byKind: { sale: number; purchase: number; receipt: number; payment: number };
  closing: number;
}) {
  const cells = [
    { label: "전기 이월", value: carried },
    { label: "매출", value: byKind.sale },
    { label: "매입", value: byKind.purchase },
    { label: "입금", value: byKind.receipt },
    { label: "출금", value: byKind.payment },
  ];
  return (
    <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-neutral-300 bg-neutral-300 text-[13px] sm:grid-cols-6">
      {cells.map((c) => (
        <div key={c.label} className="bg-white p-2 text-neutral-900">
          <div className="text-neutral-500">{c.label}</div>
          <div className="tabular-nums">{formatWon(c.value)}</div>
        </div>
      ))}
      <div className="bg-neutral-900 p-2 text-white">
        <div className="text-neutral-300">{closing >= 0 ? "최종 잔액(받을 돈)" : "최종 잔액(줄 돈)"}</div>
        <div className="font-semibold tabular-nums">{formatWon(Math.abs(closing))}</div>
      </div>
    </div>
  );
}
