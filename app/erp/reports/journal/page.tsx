import Link from "next/link";
import { loadErpData } from "@/lib/erp/repo";
import { journal } from "@/lib/erp/reports";
import { loadSuppliers } from "@/lib/erp/supplier";
import { formatDate, formatQty, formatWon } from "@/lib/erp/format";
import { Choice, DateRange, ReportShell, T, defaultRange } from "@/components/erp/report-shell";

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; kind?: string; supplier?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const kind = sp.kind === "purchase" ? "purchase" : "sale";
  const [data, { supplier, suppliers }] = await Promise.all([loadErpData(), loadSuppliers(sp.supplier)]);
  const { rows, sum } = journal(data, from, to, kind);
  const title = kind === "sale" ? "매출장" : "매입장";
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
          <Choice name="kind" label="구분" value={kind} options={[["sale", "매출장"], ["purchase", "매입장"]]} />
        </>
      }
    >
      <table className={T.table}>
        <thead>
          <tr className={T.head}>
            <th className={T.th}>날짜</th>
            <th className={T.th}>거래처</th>
            <th className={T.th}>품명</th>
            <th className={T.th}>규격</th>
            <th className={T.thr}>수량</th>
            <th className={T.thr}>단가</th>
            <th className={T.thr}>공급가</th>
            <th className={T.thr}>부가세</th>
            <th className={T.thr}>합계</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.voucher_id}-${i}`} className={T.tr}>
              <td className={`${T.td} whitespace-nowrap`}>
                <Link href={`/erp/vouchers/${r.voucher_id}`} className="hover:underline">{formatDate(r.date).slice(2)}</Link>
              </td>
              <td className={T.td}>{r.partner}</td>
              <td className={T.td}>{r.name}</td>
              <td className={T.td}>{r.spec}</td>
              <td className={T.num}>{formatQty(r.qty)}</td>
              <td className={T.num}>{formatWon(r.unit_price)}</td>
              <td className={T.num}>{formatWon(r.supply)}</td>
              <td className={T.num}>{formatWon(r.vat)}</td>
              <td className={T.num}>{formatWon(r.total)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={9} className="py-6 text-center text-neutral-500">이 기간에 거래가 없어요.</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr className={T.foot}>
            <td className={T.td} colSpan={4}>합계 ({rows.length}줄)</td>
            <td className={T.num}>{formatQty(sum.qty)}</td>
            <td />
            <td className={T.num}>{formatWon(sum.supply)}</td>
            <td className={T.num}>{formatWon(sum.vat)}</td>
            <td className={T.num}>{formatWon(sum.total)}</td>
          </tr>
        </tfoot>
      </table>
    </ReportShell>
  );
}
