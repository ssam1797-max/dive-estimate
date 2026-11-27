import { loadErpData } from "@/lib/erp/repo";
import { salesReport } from "@/lib/erp/reports";
import { loadSuppliers } from "@/lib/erp/supplier";
import { formatQty, formatWon } from "@/lib/erp/format";
import { Choice, DateRange, ReportShell, T, defaultRange } from "@/components/erp/report-shell";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; kind?: string; by?: string; supplier?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const kind = sp.kind === "purchase" ? "purchase" : "sale";
  const by = sp.by === "item" ? "item" : "partner";
  const [data, { supplier, suppliers }] = await Promise.all([loadErpData(), loadSuppliers(sp.supplier)]);
  const { rows, sum } = salesReport(data, from, to, kind, by);
  const title = `${by === "partner" ? "거래처별" : "품목별"} ${kind === "sale" ? "판매" : "구매"}현황`;
  return (
    <ReportShell
      title={title}
      fileName={`${title.replaceAll(" ", "")}_${from}_${to}`}
      from={from}
      to={to}
      supplier={supplier}
      suppliers={suppliers}
      filters={
        <>
          <DateRange from={from} to={to} />
          <Choice name="kind" label="구분" value={kind} options={[["sale", "판매(매출)"], ["purchase", "구매(매입)"]]} />
          <Choice name="by" label="기준" value={by} options={[["partner", "거래처별"], ["item", "품목별"]]} />
        </>
      }
    >
      <table className={T.table}>
        <thead>
          <tr className={T.head}>
            <th className={T.thr}>순위</th>
            <th className={T.th}>{by === "partner" ? "거래처" : "품목"}</th>
            {by === "item" && <th className={T.th}>규격</th>}
            <th className={T.thr}>전표</th>
            <th className={T.thr}>수량</th>
            <th className={T.thr}>공급가</th>
            <th className={T.thr}>부가세</th>
            <th className={T.thr}>합계</th>
            <th className={T.thr}>비율</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.key} className={T.tr}>
              <td className={T.num}>{i + 1}</td>
              <td className={T.td}>{r.name}</td>
              {by === "item" && <td className={T.td}>{r.sub}</td>}
              <td className={T.num}>{r.count}</td>
              <td className={T.num}>{formatQty(r.qty)}</td>
              <td className={T.num}>{formatWon(r.supply)}</td>
              <td className={T.num}>{formatWon(r.vat)}</td>
              <td className={T.num}>{formatWon(r.total)}</td>
              <td className={T.num}>{sum.total ? `${((r.total / sum.total) * 100).toFixed(1)}%` : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={9} className="py-6 text-center text-neutral-500">이 기간에 거래가 없어요.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className={T.foot}>
            <td className={T.td} colSpan={by === "item" ? 4 : 3}>합계</td>
            <td className={T.num}>{formatQty(sum.qty)}</td>
            <td className={T.num}>{formatWon(sum.supply)}</td>
            <td className={T.num}>{formatWon(sum.vat)}</td>
            <td className={T.num}>{formatWon(sum.total)}</td>
            <td className={T.num}>100%</td>
          </tr>
        </tfoot>
      </table>
    </ReportShell>
  );
}
