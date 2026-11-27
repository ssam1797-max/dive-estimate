import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDate, formatQty, formatWon } from "@/lib/erp/format";
import { VOUCHER_KIND_LABEL } from "@/lib/erp/types";
import type { RunningRow } from "@/lib/erp/running";
import { RowActions } from "@/components/erp/row-actions";

/**
 * 경영박사 거래처원장과 같은 형식의 표:
 * 날짜 · 계정 · 품명 · 규격 · 수량 · 단가 · 매출/출금 · 매입/입금 · 부가세 · 잔액,
 * 2줄 이상인 전표 뒤에는 건계, 맨 아래 총계와 현재 잔액.
 * 잔액은 위에서부터 누적된다(매출·출금은 더하고 매입·입금은 뺀다).
 */
export function RunningTable({
  carried: carriedRaw,
  rows: rowsRaw,
  closing: closingRaw,
  payable = false,
  paper = false,
  footnote,
}: {
  carried: number;
  rows: RunningRow[];
  closing: number;
  /** 매입처: 잔액을 "줄 돈" 기준(+)으로 뒤집어 보여준다 — 매입은 쌓이고 출금은 빠진다 */
  payable?: boolean;
  /** 흰 종이 출력용(링크·다크 모드 색 없음) */
  paper?: boolean;
  /** 현재 잔액 줄 오른쪽에 붙일 문구(예: 입금 계좌) */
  footnote?: string;
}) {
  const f = payable ? -1 : 1;
  const carried = carriedRaw * f;
  const closing = closingRaw * f;
  const rows = rowsRaw.map((r) => ({ ...r, balance: r.balance * f }));
  const owe = (v: number) => (v === 0 ? "잔액 없음" : (v > 0) !== payable ? "받을 돈" : "줄 돈");

  const line = paper ? "border-neutral-300" : "border-border";
  const sub = paper ? "bg-neutral-100" : "bg-muted/40";
  const out = (r: RunningRow) => (r.col === "out" ? r.supply : 0);
  const inn = (r: RunningRow) => (r.col === "in" ? r.supply : 0);
  const total = rows.reduce(
    (s, r) => ({ qty: s.qty + (r.qty ?? 0), out: s.out + out(r), in: s.in + inn(r), vat: s.vat + r.vat }),
    { qty: 0, out: 0, in: 0, vat: 0 }
  );

  const cell = "whitespace-nowrap px-2 py-1 text-right tabular-nums";
  const body: React.ReactNode[] = [];
  let group: RunningRow[] = [];
  const flush = () => {
    if (group.length >= 2) {
      const g = group;
      const last = g[g.length - 1];
      body.push(
        <tr key={`sub-${last.voucher_id}-${body.length}`} className={cn("border-b font-medium", line, sub)}>
          <td className="px-2 py-1" colSpan={4}>건계: No.{last.voucher_no}</td>
          <td className={cell}>{formatQty(g.reduce((s, r) => s + (r.qty ?? 0), 0))}</td>
          <td className={cell} />
          <td className={cell}>{formatWon(g.reduce((s, r) => s + out(r), 0))}</td>
          <td className={cell}>{formatWon(g.reduce((s, r) => s + inn(r), 0))}</td>
          <td className={cell}>{formatWon(g.reduce((s, r) => s + r.vat, 0))}</td>
          <td className={cell}>{formatWon(last.balance)}</td>
          {!paper && <td />}
        </tr>
      );
    }
    group = [];
  };

  rows.forEach((r, i) => {
    if (r.first) flush();
    group.push(r);
    const isMoney = r.kind === "receipt" || r.kind === "payment" || r.kind === "card_receipt";
    const label = r.kind === "card_receipt" ? "대체" : VOUCHER_KIND_LABEL[r.kind];
    const name = paper ? (
      r.name
    ) : (
      <Link href={`/erp/vouchers/${r.voucher_id}`} className="hover:underline">
        {r.name}
      </Link>
    );
    body.push(
      <tr
        key={`${r.voucher_id}-${i}`}
        className={cn("border-b", line, isMoney && !paper && "bg-emerald-50/60 dark:bg-emerald-950/30")}
      >
        <td className="whitespace-nowrap px-2 py-1 tabular-nums">{formatDate(r.voucher_date).slice(2)}</td>
        <td className="whitespace-nowrap px-2 py-1">{label}</td>
        <td className="px-2 py-1">{name}</td>
        <td className="px-2 py-1">{r.spec}</td>
        <td className={cell}>{r.qty != null ? formatQty(r.qty) : ""}</td>
        <td className={cell}>{r.unit_price != null ? formatWon(r.unit_price) : ""}</td>
        <td className={cell}>{r.col === "out" ? formatWon(r.supply) : ""}</td>
        <td className={cell}>{r.col === "in" ? formatWon(r.supply) : ""}</td>
        <td className={cell}>{isMoney && !r.vat ? "" : formatWon(r.vat)}</td>
        <td className={cn(cell, "font-medium")}>{formatWon(r.balance)}</td>
        {!paper && <td className="whitespace-nowrap px-2 py-1 text-right">{r.first && <RowActions id={r.voucher_id} />}</td>}
      </tr>
    );
  });
  flush();

  const head = paper ? "bg-neutral-100 border-neutral-900" : "bg-muted/50 text-muted-foreground";
  return (
    <div className={paper ? "" : "overflow-x-auto rounded-lg border"}>
      <table className={cn("w-full border-collapse", paper ? "text-[12px]" : "min-w-[1000px] text-sm")}>
        <thead>
          <tr className={cn("border-y text-left", head)}>
            <th className="px-2 py-1.5 font-medium">날짜</th>
            <th className="px-2 py-1.5 font-medium">계정</th>
            <th className="px-2 py-1.5 font-medium">품명</th>
            <th className="px-2 py-1.5 font-medium">규격</th>
            <th className="px-2 py-1.5 text-right font-medium">수량</th>
            <th className="px-2 py-1.5 text-right font-medium">단가</th>
            <th className="px-2 py-1.5 text-right font-medium">매출/출금</th>
            <th className="px-2 py-1.5 text-right font-medium">매입/입금</th>
            <th className="px-2 py-1.5 text-right font-medium">부가세</th>
            <th className="px-2 py-1.5 text-right font-medium">{payable ? "잔액(줄 돈)" : "잔액"}</th>
            {!paper && <th className="px-2 py-1.5"><span className="sr-only">보기·보내기</span></th>}
          </tr>
        </thead>
        <tbody>
          <tr className={cn("border-b", line)}>
            <td className="px-2 py-1" colSpan={2} />
            <td className="px-2 py-1">&lt; 전 기 이 월 &gt;</td>
            <td colSpan={6} />
            <td className={cn(cell, "font-medium")}>{formatWon(carried)}</td>
            {!paper && <td />}
          </tr>
          {body}
          {rows.length === 0 && (
            <tr>
              <td colSpan={paper ? 10 : 11} className="px-2 py-6 text-center text-neutral-500">이 기간에 거래가 없어요.</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className={cn("border-t-2 font-semibold", paper ? "border-neutral-900" : "border-foreground/40", sub)}>
            <td className="px-2 py-1.5" colSpan={4}>총계</td>
            <td className={cell}>{formatQty(total.qty)}</td>
            <td className={cell} />
            <td className={cell}>{formatWon(total.out)}</td>
            <td className={cell}>{formatWon(total.in)}</td>
            <td className={cell}>{formatWon(total.vat)}</td>
            <td className={cell}>{formatWon(closing)}</td>
            {!paper && <td />}
          </tr>
          <tr className={cn("border-t font-semibold", line)}>
            <td className="px-2 py-1.5" colSpan={2}>현재 잔액</td>
            <td className="px-2 py-1.5" colSpan={4}>
              {formatWon(Math.abs(closing))}원 {owe(closing)}
            </td>
            <td className="px-2 py-1.5 text-right font-normal" colSpan={paper ? 4 : 5}>
              {footnote}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
