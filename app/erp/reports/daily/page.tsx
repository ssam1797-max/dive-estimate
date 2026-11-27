import { loadErpData } from "@/lib/erp/repo";
import { dailyReport } from "@/lib/erp/reports";
import { loadSuppliers } from "@/lib/erp/supplier";
import { formatDate, formatWon } from "@/lib/erp/format";
import { Choice, DateRange, ReportShell, T, defaultRange } from "@/components/erp/report-shell";

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; unit?: string; supplier?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const unit = sp.unit === "month" ? "month" : "day";
  const [data, { supplier, suppliers }] = await Promise.all([loadErpData(), loadSuppliers(sp.supplier)]);
  const { rows, total } = dailyReport(data, from, to, unit);
  const title = unit === "day" ? "일계표" : "월보";
  return (
    <ReportShell
      title={title}
      fileName={`${title}_${from}_${to}`}
      from={from}
      to={to}
      supplier={supplier}
      suppliers={suppliers}
      filters={
        <>
          <DateRange from={from} to={to} />
          <Choice name="unit" label="단위" value={unit} options={[["day", "일별(일계표)"], ["month", "월별(월보)"]]} />
        </>
      }
    >
      <table className={T.table}>
        <thead>
          <tr className={T.head}>
            <th className={T.th}>{unit === "day" ? "날짜" : "월"}</th>
            <th className={T.thr}>전표</th>
            <th className={T.thr}>매출</th>
            <th className={T.thr}>매입</th>
            <th className={T.thr}>입금</th>
            <th className={T.thr}>출금</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={T.tr}>
              <td className={T.td}>{unit === "day" ? formatDate(r.key) : `${r.key.slice(0, 4)}년 ${Number(r.key.slice(5))}월`}</td>
              <td className={T.num}>{r.count}</td>
              <td className={T.num}>{r.sale ? formatWon(r.sale) : ""}</td>
              <td className={T.num}>{r.purchase ? formatWon(r.purchase) : ""}</td>
              <td className={T.num}>{r.receipt ? formatWon(r.receipt) : ""}</td>
              <td className={T.num}>{r.payment ? formatWon(r.payment) : ""}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} className="py-6 text-center text-neutral-500">이 기간에 거래가 없어요.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className={T.foot}>
            <td className={T.td}>합계</td>
            <td className={T.num}>{rows.reduce((s, r) => s + r.count, 0)}</td>
            <td className={T.num}>{formatWon(total.sale)}</td>
            <td className={T.num}>{formatWon(total.purchase)}</td>
            <td className={T.num}>{formatWon(total.receipt)}</td>
            <td className={T.num}>{formatWon(total.payment)}</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 text-[11px] text-neutral-500">금액은 부가세 포함 합계예요. 입금에는 카드입금이 포함돼요.</p>
    </ReportShell>
  );
}
