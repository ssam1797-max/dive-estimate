import Link from "next/link";
import { loadErpData } from "@/lib/erp/repo";
import { kindTotals, monthlySeries, partnersWithBalance, voucherTotals } from "@/lib/erp/compute";
import { formatDate, formatWon, monthRange, todayKST } from "@/lib/erp/format";
import { VOUCHER_KIND_LABEL } from "@/lib/erp/types";
import { CalendarBoard, type DayVoucher } from "@/components/erp/calendar-board";

export default async function ErpHomePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const sp = await searchParams;
  const data = await loadErpData();
  const today = todayKST();
  const calMonth = /^\d{4}-\d{2}$/.test(sp.month ?? "") ? sp.month! : today.slice(0, 7);
  const selectedDay = /^\d{4}-\d{2}-\d{2}$/.test(sp.day ?? "") ? sp.day! : sp.month ? null : today;
  const itemNameById = new Map(data.items.map((i) => [i.id, i.name]));
  const linesBy = new Map<number, string[]>();
  for (const l of [...data.lines].sort((a, b) => a.line_no - b.line_no)) {
    const n = (l.item_id ? itemNameById.get(l.item_id) : null) ?? l.description ?? "";
    if (!n.trim()) continue;
    const arr = linesBy.get(l.voucher_id) ?? [];
    arr.push(n);
    linesBy.set(l.voucher_id, arr);
  }
  const { from, to } = monthRange(today);
  const month = kindTotals(data, from, to);
  const series = monthlySeries(data, 12, today);
  const maxBar = Math.max(1, ...series.map((r) => Math.max(r.sale, r.purchase)));
  const partners = partnersWithBalance(data);
  const receivables = partners.filter((p) => p.balance > 0 && p.kind !== "card").sort((a, b) => b.balance - a.balance);
  const payables = partners.filter((p) => p.balance < 0).sort((a, b) => a.balance - b.balance);
  const cards = partners.filter((p) => p.kind === "card" && p.balance !== 0);
  const sum = (arr: { balance: number }[]) => arr.reduce((s, p) => s + p.balance, 0);
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const recent = [...voucherTotals(data).values()]
    .sort((a, b) => (a.voucher_date === b.voucher_date ? b.id - a.id : a.voucher_date < b.voucher_date ? 1 : -1))
    .slice(0, 8);

  const calVouchers: DayVoucher[] = [...voucherTotals(data).values()]
    .filter((v) => v.voucher_date.startsWith(calMonth))
    .sort((a, b) => a.voucher_no - b.voucher_no || a.id - b.id)
    .map((v) => {
      const names = linesBy.get(v.id) ?? [];
      return {
        id: v.id,
        date: v.voucher_date,
        no: v.voucher_no,
        kind: v.kind,
        partner: v.partner_id ? (partnerName.get(v.partner_id) ?? "") : "",
        summary: names.length > 1 ? `${names[0]} 외 ${names.length - 1}건` : (names[0] ?? v.memo ?? ""),
        total: v.total,
      };
    });

  const kpis = [
    { label: "이번 달 매출", value: month.sale },
    { label: "이번 달 매입", value: month.purchase },
    { label: "이번 달 입금", value: month.receipt + month.card_receipt },
    { label: "이번 달 출금", value: month.payment },
  ];

  return (
    <main className="flex flex-col gap-8">
      <section>
        <h1 className="text-2xl font-semibold">장부 현황</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {today.slice(0, 4)}년 {Number(today.slice(5, 7))}월 기준 · 받을 돈 {formatWon(sum(receivables))}원 · 줄 돈{" "}
          {formatWon(-sum(payables))}원
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">{k.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{formatWon(k.value)}원</div>
            </div>
          ))}
        </div>
      </section>

      <CalendarBoard month={calMonth} today={today} selectedDay={selectedDay} vouchers={calVouchers} />

      <section>
        <h2 className="text-lg font-semibold">최근 12개월 매출·매입</h2>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-sky-600" />매출</span>
          <span className="flex items-center gap-1"><span className="inline-block size-3 rounded-sm bg-amber-500" />매입</span>
        </div>
        <div className="mt-3 flex h-44 items-end gap-1 sm:gap-2">
          {series.map((r) => (
            <div key={r.month} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <div className="flex h-full items-end justify-center gap-0.5">
                <div
                  className="w-1/2 max-w-4 rounded-t bg-sky-600"
                  style={{ height: `${(r.sale / maxBar) * 100}%` }}
                  title={`${r.month} 매출 ${formatWon(r.sale)}원`}
                />
                <div
                  className="w-1/2 max-w-4 rounded-t bg-amber-500"
                  style={{ height: `${(r.purchase / maxBar) * 100}%` }}
                  title={`${r.month} 매입 ${formatWon(r.purchase)}원`}
                />
              </div>
              <div className="mt-1 text-center text-[11px] text-muted-foreground">{Number(r.month.slice(5))}월</div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-8 md:grid-cols-2">
        <BalanceList title="받을 돈(미수금)" rows={receivables} empty="받을 돈이 없어요." />
        <BalanceList title="줄 돈(미지급금)" rows={payables} empty="줄 돈이 없어요." negative />
        {cards.length > 0 && <BalanceList title="카드사 정산 예정" rows={cards} empty="" />}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">최근 전표</h2>
            <Link href="/erp/vouchers" className="text-sm text-muted-foreground hover:underline">전체 보기</Link>
          </div>
          <ul className="mt-2 divide-y rounded-lg border">
            {recent.map((v) => (
              <li key={v.id}>
                <Link href={`/erp/vouchers/${v.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-accent">
                  <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{formatDate(v.voucher_date).slice(2)}</span>
                  <span className="w-14 shrink-0">{VOUCHER_KIND_LABEL[v.kind]}</span>
                  <span className="min-w-0 flex-1 truncate">{v.partner_id ? partnerName.get(v.partner_id) : ""}</span>
                  <span className="shrink-0 tabular-nums">{formatWon(v.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

function BalanceList({
  title,
  rows,
  empty,
  negative,
}: {
  title: string;
  rows: { id: number; name: string; balance: number }[];
  empty: string;
  negative?: boolean;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-2 divide-y rounded-lg border">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/erp/partners/${p.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-accent">
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="shrink-0 tabular-nums font-medium">{formatWon(negative ? -p.balance : p.balance)}원</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
