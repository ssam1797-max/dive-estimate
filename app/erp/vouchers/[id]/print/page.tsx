import { notFound } from "next/navigation";
import { loadErpData } from "@/lib/erp/repo";
import { formatDate, formatQty, formatWon } from "@/lib/erp/format";
import { loadSuppliers } from "@/lib/erp/supplier";
import { PrintToolbar } from "@/components/erp/print-toolbar";
import { PartiesBlock } from "@/components/erp/supplier-block";

export default async function VoucherPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ supplier?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const data = await loadErpData();
  const v = data.vouchers.find((x) => x.id === id);
  if (!v || (v.kind !== "estimate" && v.kind !== "sale")) notFound();
  const partner = data.partners.find((p) => p.id === v.partner_id) ?? null;
  const itemById = new Map(data.items.map((i) => [i.id, i]));
  const lines = data.lines.filter((l) => l.voucher_id === id).sort((a, b) => a.line_no - b.line_no);
  const supply = lines.reduce((s, l) => s + l.amount, 0);
  const vat = lines.reduce((s, l) => s + l.vat, 0);
  const { suppliers, supplier } = await loadSuppliers(sp.supplier);
  const title = v.kind === "estimate" ? "견 적 서" : "거 래 명 세 서";
  const docNo = `${v.voucher_date.replaceAll("-", "").slice(2)}-${String(v.voucher_no).padStart(3, "0")}`;

  return (
    <main>
      <PrintToolbar backHref={`/erp/vouchers/${id}`} fileName={`${title.replaceAll(" ", "")}_${partner?.name ?? ""}_${docNo}`}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        supplierId={supplier?.id}
      />
      <div className="erp-print-page mx-auto w-full max-w-[210mm] bg-white p-[12mm] text-neutral-900 shadow-sm print:p-0 print:shadow-none">
        <header className="mb-6 flex items-end justify-between border-b-2 border-neutral-900 pb-3">
          <h1 className="text-3xl font-bold tracking-[0.3em]">{title}</h1>
          <div className="text-right text-[13px]">
            <div>No. {docNo}</div>
            <div>{formatDate(v.voucher_date)}</div>
          </div>
        </header>
        <PartiesBlock supplier={supplier} receiver={partner} />
        <p className="mt-5 text-[15px]">
          {v.kind === "estimate" ? "아래와 같이 견적합니다." : "아래와 같이 공급합니다."}{" "}
          <span className="font-semibold">합계금액 {formatWon(supply + vat)}원</span>
          {vat === 0 ? "" : " (부가세 포함)"}
        </p>
        <table className="mt-3 w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-y border-neutral-900 bg-neutral-100">
              <th className="w-10 py-2">No</th>
              <th className="py-2 text-left">품목</th>
              <th className="py-2 text-left">규격</th>
              <th className="py-2 text-right">수량</th>
              <th className="py-2 text-right">단가</th>
              <th className="py-2 text-right">공급가</th>
              <th className="py-2 pr-1 text-right">부가세</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const item = l.item_id ? itemById.get(l.item_id) : null;
              return (
                <tr key={l.id} className="border-b border-neutral-200">
                  <td className="py-1.5 text-center tabular-nums">{i + 1}</td>
                  <td className="py-1.5">
                    {item?.name ?? l.description}
                    {item && l.description ? <span className="text-neutral-500"> · {l.description}</span> : null}
                  </td>
                  <td className="py-1.5 text-neutral-600">{item?.spec}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatQty(l.qty)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatWon(l.unit_price)}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatWon(l.amount)}</td>
                  <td className="py-1.5 pr-1 text-right tabular-nums">{formatWon(l.vat)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900 font-semibold">
              <td colSpan={5} className="py-2 text-right">합계</td>
              <td className="py-2 text-right tabular-nums">{formatWon(supply)}</td>
              <td className="py-2 pr-1 text-right tabular-nums">{formatWon(vat)}</td>
            </tr>
          </tfoot>
        </table>
        {v.memo && <p className="mt-4 text-[13px] text-neutral-600">비고: {v.memo}</p>}
      </div>
    </main>
  );
}
