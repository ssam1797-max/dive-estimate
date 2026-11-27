import * as React from "react";
import Link from "next/link";
import { loadErpData } from "@/lib/erp/repo";
import { balanceReport, partnerBalanceSheet } from "@/lib/erp/reports";
import { loadSuppliers } from "@/lib/erp/supplier";
import { formatDate, formatWon } from "@/lib/erp/format";
import { PARTNER_KIND_LABEL } from "@/lib/erp/types";
import { Choice, DateRange, ReportShell, T, defaultRange } from "@/components/erp/report-shell";

export default async function BalanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; side?: string; supplier?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const side = sp.side === "payable" ? "payable" : sp.side === "receivable" ? "receivable" : "all";
  const [data, { supplier, suppliers }] = await Promise.all([loadErpData(), loadSuppliers(sp.supplier)]);
  const sideChoice = (
    <Choice
      name="side"
      label="구분"
      value={side}
      options={[["all", "거래처별 잔액표"], ["receivable", "미수금(받을 돈)"], ["payable", "미지급금(줄 돈)"]]}
    />
  );
  if (side === "all") {
    const sheet = partnerBalanceSheet(data, from, to);
    return (
      <ReportShell
        title="거래처별 잔액 명세서"
        fileName={`거래처별잔액_${to}`}
        from={from}
        to={to}
        supplier={supplier}
        suppliers={suppliers}
        filters={
          <>
            <DateRange from={from} to={to} />
            {sideChoice}
          </>
        }
      >
        <table className={T.table}>
          <thead>
            <tr className={T.head}>
              <th className={T.th}>상호명</th>
              <th className={T.thr}>전기이월</th>
              <th className={T.thr}>매출액</th>
              <th className={T.thr}>수금액</th>
              <th className={T.thr}>매입액</th>
              <th className={T.thr}>지급액</th>
              <th className={T.thr}>잔액</th>
              <th className={T.th}>전화</th>
            </tr>
          </thead>
          <tbody>
            {sheet.groups.map((g) => (
              <React.Fragment key={g.kind}>
                {g.rows.map((r) => (
                  <tr key={r.id} className={T.tr}>
                    <td className={T.td}>
                      <Link href={`/erp/partners/${r.id}?from=${from}&to=${to}`} className="hover:underline">{r.name}</Link>
                    </td>
                    <Money v={r.carried} />
                    <Money v={r.sale} />
                    <Money v={r.received} />
                    <Money v={r.purchase} />
                    <Money v={r.paid} />
                    <Money v={r.balance} bold />
                    <td className={T.td}>{r.tel}</td>
                  </tr>
                ))}
                <tr className="border-y border-neutral-500 bg-neutral-50 font-medium">
                  <td className={T.td}>소계: {PARTNER_KIND_LABEL[g.kind]} ({g.rows.length})</td>
                  <Money v={g.sum.carried} />
                  <Money v={g.sum.sale} />
                  <Money v={g.sum.received} />
                  <Money v={g.sum.purchase} />
                  <Money v={g.sum.paid} />
                  <Money v={g.sum.balance} bold />
                  <td />
                </tr>
              </React.Fragment>
            ))}
            {sheet.count === 0 && (
              <tr><td colSpan={8} className="py-6 text-center text-neutral-500">기간 안에 거래나 잔액이 있는 거래처가 없어요.</td></tr>
            )}
          </tbody>
          <tfoot>
            <tr className={T.foot}>
              <td className={T.td}>총계 ({sheet.count})</td>
              <Money v={sheet.total.carried} />
              <Money v={sheet.total.sale} />
              <Money v={sheet.total.received} />
              <Money v={sheet.total.purchase} />
              <Money v={sheet.total.paid} />
              <Money v={sheet.total.balance} bold />
              <td />
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-[11px] text-neutral-500">
          잔액 = 전기이월 + 매출액 − 수금액 − 매입액 + 지급액. 빨간 금액(−)은 줄 돈이에요. 거래처 이름을 누르면 원장으로 가요.
        </p>
      </ReportShell>
    );
  }
  const { receivable, payable } = balanceReport(data, from, to);
  const rows = side === "receivable" ? receivable : payable;
  const f = side === "receivable" ? 1 : -1;
  const title = side === "receivable" ? "미수금현황" : "미지급금현황";
  const sum = rows.reduce(
    (s, r) => ({ carried: s.carried + r.carried * f, inc: s.inc + r.inc, dec: s.dec + r.dec, balance: s.balance + r.balance * f }),
    { carried: 0, inc: 0, dec: 0, balance: 0 }
  );
  return (
    <ReportShell
      title={title}
      fileName={`${title}_${to}`}
      from={from}
      to={to}
      supplier={supplier}
      suppliers={suppliers}
      filters={
        <>
          <DateRange from={from} to={to} />
          {sideChoice}
        </>
      }
    >
      <table className={T.table}>
        <thead>
          <tr className={T.head}>
            <th className={T.th}>거래처</th>
            <th className={T.th}>구분</th>
            <th className={T.th}>연락처</th>
            <th className={T.thr}>전기 이월</th>
            <th className={T.thr}>{side === "receivable" ? "매출 등(+)" : "출금 등(−)"}</th>
            <th className={T.thr}>{side === "receivable" ? "입금 등(−)" : "매입 등(+)"}</th>
            <th className={T.thr}>{side === "receivable" ? "받을 돈" : "줄 돈"}</th>
            <th className={T.th}>최근 거래</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={T.tr}>
              <td className={T.td}>
                <Link href={`/erp/partners/${r.id}?from=${from}&to=${to}`} className="hover:underline">{r.name}</Link>
              </td>
              <td className={T.td}>{PARTNER_KIND_LABEL[r.kind]}</td>
              <td className={T.td}>{r.tel}</td>
              <td className={T.num}>{formatWon(r.carried * f)}</td>
              <td className={T.num}>{formatWon(r.inc)}</td>
              <td className={T.num}>{formatWon(r.dec)}</td>
              <td className={`${T.num} font-semibold`}>{formatWon(r.balance * f)}</td>
              <td className={T.td}>{r.last ? formatDate(r.last) : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="py-6 text-center text-neutral-500">{side === "receivable" ? "받을 돈이 없어요." : "줄 돈이 없어요."}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className={T.foot}>
            <td className={T.td} colSpan={3}>합계 ({rows.length}곳)</td>
            <td className={T.num}>{formatWon(sum.carried)}</td>
            <td className={T.num}>{formatWon(sum.inc)}</td>
            <td className={T.num}>{formatWon(sum.dec)}</td>
            <td className={T.num}>{formatWon(sum.balance)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[11px] text-neutral-500">
        종료일 기준 잔액이에요. 늘어남·줄어듦은 기간 안의 거래예요. 거래처 이름을 누르면 원장으로 가요.
      </p>
    </ReportShell>
  );
}

function Money({ v, bold }: { v: number; bold?: boolean }) {
  return (
    <td className={`${T.num} ${v < 0 ? "text-red-600" : ""} ${bold ? "font-semibold" : ""}`}>{formatWon(v)}</td>
  );
}
