import Link from "next/link";
import { loadErpData } from "@/lib/erp/repo";
import { itemLedger } from "@/lib/erp/reports";
import { loadSuppliers } from "@/lib/erp/supplier";
import { formatDate, formatQty, formatWon } from "@/lib/erp/format";
import { VOUCHER_KIND_LABEL } from "@/lib/erp/types";
import { DateRange, ReportShell, T, defaultRange } from "@/components/erp/report-shell";

export default async function ItemLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; item?: string; supplier?: string }>;
}) {
  const sp = await searchParams;
  const { from, to } = defaultRange(sp);
  const [data, { supplier, suppliers }] = await Promise.all([loadErpData(), loadSuppliers(sp.supplier)]);
  const items = [...data.items].filter((i) => i.active || String(i.id) === sp.item).sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const itemId = Number(sp.item) || null;
  const ledger = itemId ? itemLedger(data, itemId, from, to) : null;
  const name = ledger?.item?.name ?? "";
  return (
    <ReportShell
      title="품목별 원장"
      fileName={`품목별원장_${name}_${from}_${to}`}
      from={from}
      to={to}
      supplier={supplier}
      suppliers={suppliers}
      filters={
        <>
          <DateRange from={from} to={to} />
          <label className="flex min-w-56 flex-col gap-1">
            <span className="text-muted-foreground">품목</span>
            <select name="item" defaultValue={itemId ?? ""} className="h-9 rounded-md border bg-background px-2 text-base sm:text-sm">
              <option value="">품목을 고르세요</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>{i.name}{i.spec ? ` (${i.spec})` : ""}{i.track_stock ? " · 재고관리" : ""}</option>
              ))}
            </select>
          </label>
        </>
      }
    >
      {!ledger ? (
        <p className="py-10 text-center text-neutral-500">위에서 품목을 고르고 [조회]를 눌러 주세요.</p>
      ) : (
        <>
          <p className="mb-2 text-[13px]">
            <b>{name}</b>
            {ledger.item?.spec ? ` · ${ledger.item.spec}` : ""}
            {ledger.item && !ledger.item.track_stock && " · 재고관리를 하지 않는 품목이라 재고는 참고용이에요"}
          </p>
          <table className={T.table}>
            <thead>
              <tr className={T.head}>
                <th className={T.th}>날짜</th>
                <th className={T.th}>구분</th>
                <th className={T.th}>거래처</th>
                <th className={T.thr}>입고</th>
                <th className={T.thr}>출고</th>
                <th className={T.thr}>단가</th>
                <th className={T.thr}>금액</th>
                <th className={T.thr}>재고</th>
              </tr>
            </thead>
            <tbody>
              <tr className={T.tr}>
                <td className={T.td} colSpan={7}>&lt; 전 기 이 월 &gt;</td>
                <td className={T.num}>{formatQty(ledger.carried)}</td>
              </tr>
              {ledger.rows.map((r, i) => (
                <tr key={`${r.voucher_id}-${i}`} className={T.tr}>
                  <td className={`${T.td} whitespace-nowrap`}>
                    <Link href={`/erp/vouchers/${r.voucher_id}`} className="hover:underline">{formatDate(r.date).slice(2)}</Link>
                  </td>
                  <td className={T.td}>{VOUCHER_KIND_LABEL[r.kind]}</td>
                  <td className={T.td}>{r.partner}</td>
                  <td className={T.num}>{r.inQty ? formatQty(r.inQty) : ""}</td>
                  <td className={T.num}>{r.outQty ? formatQty(r.outQty) : ""}</td>
                  <td className={T.num}>{formatWon(r.unit_price)}</td>
                  <td className={T.num}>{formatWon(r.amount)}</td>
                  <td className={`${T.num} font-medium`}>{formatQty(r.stock)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={T.foot}>
                <td className={T.td} colSpan={3}>합계</td>
                <td className={T.num}>{formatQty(ledger.sum.inQty)}</td>
                <td className={T.num}>{formatQty(ledger.sum.outQty)}</td>
                <td colSpan={2} />
                <td className={T.num}>{formatQty(ledger.closing)}</td>
              </tr>
            </tfoot>
          </table>
        </>
      )}
    </ReportShell>
  );
}
