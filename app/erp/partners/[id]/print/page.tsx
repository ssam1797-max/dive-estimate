import { notFound } from "next/navigation";
import { loadErpData } from "@/lib/erp/repo";
import { partnerLedger } from "@/lib/erp/ledger";
import { formatDate, todayKST } from "@/lib/erp/format";
import { LedgerSummary } from "@/components/erp/ledger-summary";
import { loadSuppliers } from "@/lib/erp/supplier";
import { RunningTable } from "@/components/erp/running-table";
import { partnerRunning } from "@/lib/erp/running";
import { getBankAccountSettings } from "@/lib/db/settings-repo";
import { PrintToolbar } from "@/components/erp/print-toolbar";

export default async function PartnerLedgerPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; supplier?: string }>;
}) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const today = todayKST();
  const from = sp.from || `${today.slice(0, 4)}-01-01`;
  const to = sp.to || today;
  const data = await loadErpData();
  const ledger = partnerLedger(data, id, from, to);
  if (!ledger.partner) notFound();
  const { suppliers, supplier } = await loadSuppliers(sp.supplier);
  const running = partnerRunning(data, id, from, to);
  let bankLine = "";
  try {
    const b = await getBankAccountSettings();
    bankLine = [b.accountNumber, b.bankName, b.accountHolder && `(${b.accountHolder})`].filter(Boolean).join(" ");
  } catch (e) {
    console.error("입금 계좌 조회 실패:", e);
  }

  return (
    <main>
      <PrintToolbar backHref={`/erp/partners/${id}?from=${from}&to=${to}`} fileName={`거래처원장_${ledger.partner.name}_${from}_${to}`}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        supplierId={supplier?.id}
      />
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
        <LedgerSummary carried={ledger.carried} byKind={ledger.byKind} closing={ledger.closing} />
        <RunningTable
          carried={running.carried}
          rows={running.rows}
          closing={running.closing}
          payable={ledger.partner.kind === "supplier"}
          paper
          footnote={bankLine}
        />
      </div>
    </main>
  );
}
