import { matchesKoreanSearch } from "@/lib/hangul";
import Link from "next/link";
import { loadErpData } from "@/lib/erp/repo";
import { partnersWithBalance } from "@/lib/erp/compute";
import { formatDate, formatWon } from "@/lib/erp/format";
import { PARTNER_KINDS, PARTNER_KIND_LABEL, type PartnerKind } from "@/lib/erp/types";
import { NewPartnerButton } from "@/components/erp/new-partner-button";
import { cn } from "@/lib/utils";

export default async function PartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; all?: string }>;
}) {
  const sp = await searchParams;
  const kind = PARTNER_KINDS.includes(sp.kind as PartnerKind) ? (sp.kind as PartnerKind) : null;
  const q = (sp.q ?? "").trim().toLowerCase();
  const data = await loadErpData();
  const rows = partnersWithBalance(data)
    .filter((p) => sp.all || p.active)
    .filter((p) => !kind || p.kind === kind)
    .filter((p) => !q || matchesKoreanSearch([p.name, p.rep_name, p.contact, p.tel, p.mobile, p.biz_no].filter(Boolean).join(" "), q))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  const tab = (k: PartnerKind | null, label: string) => {
    const params = new URLSearchParams();
    if (k) params.set("kind", k);
    if (sp.q) params.set("q", sp.q);
    return (
      <Link
        key={label}
        href={`/erp/partners${params.size ? `?${params}` : ""}`}
        className={cn(
          "rounded-md px-3 py-1.5 text-sm",
          kind === k ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-2xl font-semibold">거래처</h1>
        <NewPartnerButton />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
          {tab(null, "전체")}
          {PARTNER_KINDS.map((k) => tab(k, PARTNER_KIND_LABEL[k]))}
        </nav>
        <form method="get" className="ml-auto flex gap-2">
          {kind && <input type="hidden" name="kind" value={kind} />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder="회사·대표·담당·전화 (초성 가능)" className="h-9 w-64 rounded-md border px-2 text-base sm:text-sm" />
          <button className="h-9 rounded-md border px-3 text-sm hover:bg-accent">검색</button>
        </form>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">거래처</th>
              <th className="px-3 py-2 font-medium">구분</th>
              <th className="px-3 py-2 font-medium">연락처</th>
              <th className="px-3 py-2 font-medium">최근 거래</th>
              <th className="px-3 py-2 text-right font-medium">잔액</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((p) => (
              <tr key={p.id} className="hover:bg-accent/50">
                <td className="px-3 py-2">
                  <Link href={`/erp/partners/${p.id}`} className="font-medium hover:underline">{p.name}</Link>
                  {!p.active && <span className="ml-2 text-xs text-muted-foreground">(사용 안 함)</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                  {PARTNER_KIND_LABEL[p.kind]}
                  {(p.kind === "customer" || p.kind === "consumer") && ` · ${p.price_grade}등급`}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{p.mobile || p.tel}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                  {p.last_date ? formatDate(p.last_date) : ""}
                </td>
                <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", p.balance < 0 && "text-rose-700 dark:text-rose-400")}>
                  {p.balance === 0 ? "-" : `${formatWon(Math.abs(p.balance))} ${p.balance > 0 ? "받을" : "줄"}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        잔액: &lsquo;받을&rsquo;은 미수금, &lsquo;줄&rsquo;은 미지급금이에요.{" "}
        {!sp.all && <Link className="underline" href="/erp/partners?all=1">사용 안 함 거래처까지 보기</Link>}
      </p>
    </main>
  );
}
