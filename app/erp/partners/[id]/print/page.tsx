import { notFound } from "next/navigation";
import { loadErpData } from "@/lib/erp/repo";
import { partnerLedger } from "@/lib/erp/ledger";
import { formatDate, formatWon, todayKST } from "@/lib/erp/format";
import { getProfilesByType } from "@/lib/db/profile-repo";
import { LedgerTable } from "@/components/erp/ledger-table";
import { PrintToolbar } from "@/components/erp/print-toolbar";

export default async function PartnerLedgerPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const today = todayKST();
  const from = sp.from || `${today.slice(0, 4)}-01-01`;
  const to = sp.to || today;
  const data = await loadErpData();
  const ledger = partnerLedger(data, id, from, to);
  if (!ledger.partner) notFound();
  let supplier = null;
  try {
    supplier = (await getProfilesByType("PROVIDER"))[0] ?? null;
  } catch (e) {
    console.error("공급자 정보 조회 실패:", e);
  }
  const bal = ledger.closing;

  return (
    <main>
      <PrintToolbar backHref={`/erp/partners/${id}?from=${from}&to=${to}`} fileName={`거래처원장_${ledger.partner.name}_${from}_${to}`} />
      <div className="erp-print-page mx-auto w-full max-w-[210mm] bg-white p-[12mm] text-neutral-900 shadow-sm print:p-0 print:shadow-none">
        <header className="mb-4 border-b-2 border-neutral-900 pb-3">
          <h1 className="text-2xl font-bold tracking-[0.2em]">거래처원장</h1>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[13px]">
            <span>
              <b>{ledger.partner.name}</b> 귀하 · 기간 {formatDate(from)} ~ {formatDate(to)}
            </span>
            <span>{supplier?.name}{supplier?.contact ? ` · ${supplier.contact}` : ""}</span>
          </div>
        </header>
        <LedgerTable {...ledger} linkRows={false} paper />
        <p className="mt-4 text-right text-[15px] font-semibold">
          {bal === 0 ? "잔액 없음" : `${bal > 0 ? "받을 금액" : "지급할 금액"} ${formatWon(Math.abs(bal))}원`}
        </p>
      </div>
    </main>
  );
}
