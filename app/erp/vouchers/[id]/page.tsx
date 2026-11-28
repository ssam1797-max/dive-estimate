import { notFound } from "next/navigation";
import { loadErpData } from "@/lib/erp/repo";
import { itemsWithStock, partnersWithBalance, recentPrices, recentVouchers } from "@/lib/erp/compute";
import { todayKST } from "@/lib/erp/format";
import { VoucherForm } from "@/components/erp/voucher-form";

export default async function VoucherDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; converted?: string }>;
}) {
  const { id: idStr } = await params;
  const sp = await searchParams;
  const id = Number(idStr);
  const data = await loadErpData();
  const v = data.vouchers.find((x) => x.id === id);
  if (!v) notFound();
  const lines = data.lines.filter((l) => l.voucher_id === id).sort((a, b) => a.line_no - b.line_no);
  const derived = data.vouchers
    .filter((x) => x.source_voucher_id === id)
    .map((x) => ({ id: x.id, kind: x.kind, voucher_date: x.voucher_date }));

  return (
    <>
      {(sp.saved || sp.converted) && (
        <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900 print:hidden dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {sp.converted ? "견적 내용을 옮겨 새 전표를 만들었어요. 필요하면 고친 뒤 [수정 저장]을 누르세요." : "저장했어요."}
        </p>
      )}
      <VoucherForm
        key={`${id}-${lines.length}-${v.voucher_date}`}
        partners={partnersWithBalance(data)}
        items={itemsWithStock(data)}
        recent={recentPrices(data, id)}
        recentVouchers={recentVouchers(data, 15, id)}
        groups={data.groups}
        defaultDate={todayKST()}
        derived={derived}
        initial={{
          id: v.id,
          voucher_no: v.voucher_no,
          voucher_date: v.voucher_date,
          kind: v.kind,
          partner_id: v.partner_id,
          card_partner_id: v.card_partner_id,
          memo: v.memo ?? "",
          source_voucher_id: v.source_voucher_id,
          lines: lines.map((l) => ({
            item_id: l.item_id,
            description: l.description ?? "",
            qty: l.qty,
            unit_price: l.unit_price,
            amount: l.amount,
            vat: l.vat,
          })),
        }}
      />
    </>
  );
}
