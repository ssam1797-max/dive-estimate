import Link from "next/link";
import { formatDate, formatWon } from "@/lib/erp/format";
import { VOUCHER_KIND_LABEL, type VoucherKind } from "@/lib/erp/types";
import type { LedgerRow } from "@/lib/erp/ledger";

export function LedgerTable({
  carried,
  rows,
  sumInc,
  sumDec,
  closing,
  linkRows = true,
  paper = false,
}: {
  carried: number;
  rows: LedgerRow[];
  sumInc: number;
  sumDec: number;
  closing: number;
  linkRows?: boolean;
  /** 흰 종이(출력물) 위에 그릴 때 true — 다크 모드 색을 쓰지 않는다 */
  paper?: boolean;
}) {
  const line = paper ? "border-neutral-200" : "border-border";
  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className={paper ? "border-y border-neutral-900 bg-neutral-100 text-left" : "border-y bg-muted/50 text-left text-muted-foreground"}>
          <th className="px-2 py-2">날짜</th>
          <th className="px-2 py-2">구분</th>
          <th className="px-2 py-2">내용</th>
          <th className="px-2 py-2 text-right">늘어남</th>
          <th className="px-2 py-2 text-right">줄어듦</th>
          <th className="px-2 py-2 text-right">잔액</th>
        </tr>
      </thead>
      <tbody>
        <tr className={`border-b ${line}`}>
          <td className="px-2 py-1.5" colSpan={5}>전기 이월</td>
          <td className="px-2 py-1.5 text-right tabular-nums">{formatWon(carried)}</td>
        </tr>
        {rows.map((r) => (
          <tr key={`${r.voucher_id}-${r.kind}-${r.balance}`} className={`border-b ${line}`}>
            <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
              {linkRows ? (
                <Link className="hover:underline" href={`/erp/vouchers/${r.voucher_id}`}>{formatDate(r.voucher_date)}</Link>
              ) : (
                formatDate(r.voucher_date)
              )}
            </td>
            <td className="whitespace-nowrap px-2 py-1.5">{VOUCHER_KIND_LABEL[r.kind as VoucherKind]}</td>
            <td className="px-2 py-1.5">{r.summary}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.increase ? formatWon(r.increase) : ""}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{r.decrease ? formatWon(r.decrease) : ""}</td>
            <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums">{formatWon(r.balance)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className={`border-t-2 font-semibold ${paper ? "border-neutral-900" : "border-foreground/40"}`}>
          <td className="px-2 py-2" colSpan={3}>기간 합계 / 기말 잔액</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatWon(sumInc)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatWon(sumDec)}</td>
          <td className="px-2 py-2 text-right tabular-nums">{formatWon(closing)}</td>
        </tr>
      </tfoot>
    </table>
  );
}
