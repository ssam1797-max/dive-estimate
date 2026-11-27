import * as React from "react";
import Link from "next/link";
import { formatDate, formatQty, formatWon } from "@/lib/erp/format";
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
  detailed = false,
}: {
  carried: number;
  rows: LedgerRow[];
  sumInc: number;
  sumDec: number;
  closing: number;
  linkRows?: boolean;
  /** 흰 종이(출력물) 위에 그릴 때 true — 다크 모드 색을 쓰지 않는다 */
  paper?: boolean;
  /** 매출·매입 줄 아래에 품목(수량×단가)을 펼쳐 보여준다 */
  detailed?: boolean;
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
          <React.Fragment key={`${r.voucher_id}-${r.kind}-${r.balance}`}>
          <tr className={`border-b ${line}`}>
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
          {detailed && r.details.length > 0 && (
            <tr className={`border-b ${line}`}>
              <td />
              <td />
              <td colSpan={4} className="px-2 pb-2 pt-0">
                <ul className={`text-[12px] ${paper ? "text-neutral-600" : "text-muted-foreground"}`}>
                  {r.details.map((d, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="min-w-0 flex-1">· {d.name}</span>
                      <span className="whitespace-nowrap tabular-nums">
                        {formatQty(d.qty)} × {formatWon(d.unit_price)}
                      </span>
                      <span className="w-24 whitespace-nowrap text-right tabular-nums">{formatWon(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          )}
          </React.Fragment>
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
