import Link from "next/link";
import { notFound } from "next/navigation";
import { loadErpData } from "@/lib/erp/repo";
import { partnerLedger } from "@/lib/erp/ledger";
import { formatWon, todayKST } from "@/lib/erp/format";
import { PARTNER_KIND_LABEL } from "@/lib/erp/types";
import { LedgerTable } from "@/components/erp/ledger-table";
import { PartnerForm } from "@/components/erp/partner-form";

export default async function PartnerDetailPage({
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
  const p = ledger.partner;
  const qs = new URLSearchParams({ from, to }).toString();
  const bal = ledger.closing;

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold">{p.name}</h1>
        <span className="text-sm text-muted-foreground">{PARTNER_KIND_LABEL[p.kind]}</span>
        <span className="text-sm font-medium">
          {bal === 0 ? "잔액 없음" : `${formatWon(Math.abs(bal))}원 ${bal > 0 ? "받을 돈" : "줄 돈"}`}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Link href={`/erp/vouchers/new?partner=${id}&kind=${p.kind === "supplier" ? "purchase" : "sale"}`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent">
            {p.kind === "supplier" ? "매입 입력" : "매출 입력"}
          </Link>
          <Link href={`/erp/vouchers/new?partner=${id}&kind=${p.kind === "supplier" ? "payment" : "receipt"}`} className="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-accent">
            {p.kind === "supplier" ? "출금 입력" : "입금 입력"}
          </Link>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <h2 className="mr-auto text-lg font-semibold">거래처원장</h2>
          <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
            <input type="date" name="from" defaultValue={from} className="h-9 rounded-md border px-2 text-base sm:text-sm" />
            <span className="pb-2">~</span>
            <input type="date" name="to" defaultValue={to} className="h-9 rounded-md border px-2 text-base sm:text-sm" />
            <button className="h-9 rounded-md border px-3 hover:bg-accent">조회</button>
          </form>
          <Link href={`/erp/partners/${id}/print?${qs}`} className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            원장 출력
          </Link>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <LedgerTable {...ledger} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">거래처 정보</h2>
        <PartnerForm partner={p} />
      </section>
    </main>
  );
}
