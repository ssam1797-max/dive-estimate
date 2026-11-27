import Link from "next/link";
import { loadErpData } from "@/lib/erp/repo";
import { stockReport } from "@/lib/erp/reports";
import { loadSuppliers } from "@/lib/erp/supplier";
import { formatQty, formatWon } from "@/lib/erp/format";
import { DateRange, ReportShell, T, defaultRange } from "@/components/erp/report-shell";

export default async function StockReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; supplier?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const [data, { supplier, suppliers }] = await Promise.all([loadErpData(), loadSuppliers(sp.supplier)]);
  const { rows, sum } = stockReport(data, from, to);
  return (
    <ReportShell
      title="재고보고서"
      fileName={`재고보고서_${to}`}
      from={from}
      to={to}
      supplier={supplier}
      suppliers={suppliers}
      filters={<DateRange from={from} to={to} />}
    >
      <table className={T.table}>
        <thead>
          <tr className={T.head}>
            <th className={T.th}>품명</th>
            <th className={T.th}>규격</th>
            <th className={T.th}>분류</th>
            <th className={T.thr}>기초</th>
            <th className={T.thr}>입고</th>
            <th className={T.thr}>출고</th>
            <th className={T.thr}>현재고</th>
            <th className={T.thr}>매입가</th>
            <th className={T.thr}>재고금액</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={T.tr}>
              <td className={T.td}>
                <Link href={`/erp/reports/item-ledger?item=${r.id}&from=${from}&to=${to}`} className="hover:underline">{r.name}</Link>
              </td>
              <td className={T.td}>{r.spec}</td>
              <td className={T.td}>{r.group}</td>
              <td className={T.num}>{formatQty(r.opening)}</td>
              <td className={T.num}>{r.inQty ? formatQty(r.inQty) : ""}</td>
              <td className={T.num}>{r.outQty ? formatQty(r.outQty) : ""}</td>
              <td className={`${T.num} font-semibold ${r.stock < 0 ? "text-rose-700" : ""}`}>{formatQty(r.stock)} {r.unit}</td>
              <td className={T.num}>{formatWon(r.cost)}</td>
              <td className={T.num}>{formatWon(r.value)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={9} className="py-6 text-center text-neutral-500">재고관리 품목이 없어요. 품목·재고 화면에서 &lsquo;재고관리 하기&rsquo;를 켜 주세요.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className={T.foot}>
            <td className={T.td} colSpan={8}>재고금액 합계 ({rows.length}개 품목)</td>
            <td className={T.num}>{formatWon(sum.value)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[11px] text-neutral-500">
        재고관리를 켠 품목만 나와요. 기초는 시작일 이전 재고, 현재고는 종료일 기준이에요. 재고금액은 현재고 × 매입가예요. 품명을 누르면 품목별 원장으로 가요.
      </p>
    </ReportShell>
  );
}
