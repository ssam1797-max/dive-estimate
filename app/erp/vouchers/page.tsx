import Link from "next/link";
import { Share2 } from "lucide-react";
import { loadErpData } from "@/lib/erp/repo";
import { voucherTotals } from "@/lib/erp/compute";
import { formatDate, formatQty, formatWon, todayKST } from "@/lib/erp/format";
import { PARTNER_KIND_LABEL, VOUCHER_KINDS, VOUCHER_KIND_LABEL, type VoucherKind } from "@/lib/erp/types";
import { KindBadge } from "@/components/erp/kind-badge";
import { RunningTable } from "@/components/erp/running-table";
import { RowActions } from "@/components/erp/row-actions";
import { partnerRunning } from "@/lib/erp/running";
import { PartnerFilter } from "@/components/erp/partner-filter";
import { matchesKoreanSearch } from "@/lib/hangul";

type Search = { kind?: string; from?: string; to?: string; partner?: string; q?: string };

export default async function VoucherListPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const today = todayKST();
  const from = sp.from || `${today.slice(0, 4)}-01-01`;
  const to = sp.to || today;
  const kind = VOUCHER_KINDS.includes(sp.kind as VoucherKind) ? (sp.kind as VoucherKind) : null;
  const partnerId = sp.partner ? Number(sp.partner) : null;
  const q = (sp.q ?? "").trim();

  const data = await loadErpData();
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const linesByVoucher = new Map<number, string[]>();
  const amountsByVoucher = new Map<number, number[]>();
  const qtyByVoucher = new Map<number, number>();
  for (const l of [...data.lines].sort((a, b) => a.line_no - b.line_no)) {
    const am = amountsByVoucher.get(l.voucher_id) ?? [];
    am.push(l.amount + l.vat);
    amountsByVoucher.set(l.voucher_id, am);
    if (l.item_id != null) qtyByVoucher.set(l.voucher_id, (qtyByVoucher.get(l.voucher_id) ?? 0) + l.qty);
    const arr = linesByVoucher.get(l.voucher_id) ?? [];
    arr.push((l.item_id ? itemName.get(l.item_id) : null) ?? l.description ?? "");
    linesByVoucher.set(l.voucher_id, arr);
  }

  const rows = [...voucherTotals(data).values()]
    .filter((v) => v.voucher_date >= from && v.voucher_date <= to)
    .filter((v) => !kind || v.kind === kind)
    .filter((v) => !partnerId || v.partner_id === partnerId || v.card_partner_id === partnerId)
    .filter((v) => {
      if (!q) return true;
      const hay = [
        partnerName.get(v.partner_id ?? -1),
        partnerName.get(v.card_partner_id ?? -1),
        v.memo,
        ...(linesByVoucher.get(v.id) ?? []),
      ];
      // 거래처·품목 이름은 초성(ㅅㅇㄷ)으로도 찾을 수 있게
      return hay.some((h) => h && matchesKoreanSearch(h, q));
    })
    .sort((a, b) =>
      a.voucher_date === b.voucher_date ? b.voucher_no - a.voucher_no : a.voucher_date < b.voucher_date ? 1 : -1
    );
  // 거래처를 고르면 경영박사처럼 품목 줄마다 누적 잔액을 보여준다(견적 제외)
  const running = partnerId && kind !== "estimate" ? partnerRunning(data, partnerId, from, to) : null;

  // 견적은 장부(매출·매입·잔액)에 반영되지 않으므로 합계에서 따로 보여준다
  const total = rows.filter((r) => r.kind !== "estimate").reduce((s, r) => s + r.total, 0);
  const estimateTotal = rows.filter((r) => r.kind === "estimate").reduce((s, r) => s + r.total, 0);

  // 경영박사 전표찾기 상단처럼 기간 안의 종류별 합계(견적 제외)
  const sumBy = (k: VoucherKind) => rows.filter((r) => r.kind === k).reduce((s, r) => s + r.total, 0);
  const bar: [string, number][] = [
    ["매출", sumBy("sale")],
    ["매입", sumBy("purchase")],
    ["입금", sumBy("receipt")],
    ["카드입금", sumBy("card_receipt")],
    ["출금", sumBy("payment")],
  ];
  const keep = new URLSearchParams();
  if (kind) keep.set("kind", kind);
  if (partnerId) keep.set("partner", String(partnerId));
  if (q) keep.set("q", q);
  const rangeHref = (f: string, t: string) => {
    const u = new URLSearchParams(keep);
    u.set("from", f);
    u.set("to", t);
    return `/erp/vouchers?${u.toString()}`;
  };

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">전표</h1>
      <nav aria-label="빠른 기간" className="flex flex-wrap gap-1 text-sm">
        {quickRanges(today).map(([label, f, t]) => (
          <Link
            key={label}
            href={rangeHref(f, t)}
            className={`rounded-md border px-3 py-1.5 ${f === from && t === to ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"}`}
          >
            {label}
          </Link>
        ))}
      </nav>
      <form className="flex flex-wrap items-end gap-2 rounded-lg border p-3 text-sm" method="get">
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">시작일</span>
          <input type="date" name="from" defaultValue={from} className="h-9 rounded-md border px-2 text-base sm:text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">종료일</span>
          <input type="date" name="to" defaultValue={to} className="h-9 rounded-md border px-2 text-base sm:text-sm" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">종류</span>
          <select name="kind" defaultValue={kind ?? ""} className="h-9 rounded-md border bg-background px-2 text-base sm:text-sm">
            <option value="">전체</option>
            {VOUCHER_KINDS.map((k) => (
              <option key={k} value={k}>{VOUCHER_KIND_LABEL[k]}</option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground">거래처</span>
          <PartnerFilter
            defaultValue={partnerId ? String(partnerId) : ""}
            options={[...data.partners]
              .sort((a, b) => a.name.localeCompare(b.name, "ko"))
              .map((p) => ({
                value: String(p.id),
                label: p.name,
                description: [PARTNER_KIND_LABEL[p.kind], p.rep_name && `대표 ${p.rep_name}`, p.contact && `담당 ${p.contact}`]
                  .filter(Boolean)
                  .join(" · "),
                keywords: [p.rep_name, p.contact, p.tel, p.mobile].filter(Boolean).join(" "),
              }))}
          />
        </div>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-muted-foreground">검색(거래처·품목·적요)</span>
          <input name="q" defaultValue={q} className="h-9 rounded-md border px-2 text-base sm:text-sm" />
        </label>
        <button className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground">조회</button>
      </form>

      {running ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <div className="min-w-0 flex-1 text-sm">
              <b>{partnerName.get(partnerId!)}</b> 거래처원장 · {formatDate(from)} ~ {formatDate(to)}
            </div>
            <Link
              href={`/erp/partners/${partnerId}/print?from=${from}&to=${to}`}
              className="inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              <Share2 className="size-4" /> 이 원장 출력·보내기
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            위에서부터 날짜순 · 매출·매입은 잔액에 더하고, 입금·출금은 빼요.
            {(kind || q) && " (종류·검색 조건은 잔액 계산에는 적용되지 않아요)"}
          </p>
          <RunningTable
            carried={running.carried}
            closing={running.closing}
            payable={running.partner?.kind === "supplier"}
            rows={running.rows.filter((r) => {
              if (kind && r.kind !== kind) return false;
              if (q && !`${r.name}`.toLowerCase().includes(q.toLowerCase())) return false;
              return true;
            })}
          />
        </>
      ) : (
        <>
      <div className="flex flex-wrap gap-x-5 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
          {bar.map(([label, v]) => (
            <span key={label}>
              <span className="text-muted-foreground">{label}</span>{" "}
              <b className="tabular-nums">{formatWon(v)}</b>
            </span>
          ))}
        </div>
      <p className="text-sm text-muted-foreground">
          {rows.length}건 · 합계 {formatWon(total)}원
          {estimateTotal > 0 && ` (견적 ${formatWon(estimateTotal)}원은 장부에 반영되지 않아 합계에서 제외)`}
        </p>
  
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">날짜</th>
                <th className="px-3 py-2 font-medium">번호</th>
                <th className="px-3 py-2 font-medium">종류</th>
                <th className="px-3 py-2 font-medium">거래처</th>
                <th className="px-3 py-2 font-medium">내용</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">공급가</th>
                <th className="px-3 py-2 text-right font-medium">부가세</th>
                <th className="px-3 py-2 text-right font-medium">합계</th>
                <th className="px-3 py-2 text-right font-medium"><span className="sr-only">보기·보내기</span></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((v) => {
                const names = (linesByVoucher.get(v.id) ?? []).filter((n) => n.trim() !== "");
                const summary =
                  names.length > 1
                    ? `${names[0]} 외 ${names.length - 1}건`
                    : names[0] || v.memo || moneySummary(VOUCHER_KIND_LABEL[v.kind], amountsByVoucher.get(v.id) ?? []);
                return (
                  <tr key={v.id} className="hover:bg-accent/50">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      <Link href={`/erp/vouchers/${v.id}`} className="hover:underline">{formatDate(v.voucher_date)}</Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-muted-foreground">{v.voucher_no}</td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <KindBadge kind={v.kind} />
                    </td>
                    <td className="max-w-40 truncate px-3 py-2">
                      <Link href={`/erp/vouchers/${v.id}`} className="hover:underline">
                        {v.partner_id ? partnerName.get(v.partner_id) : ""}
                        {v.card_partner_id ? ` → ${partnerName.get(v.card_partner_id)}` : ""}
                      </Link>
                    </td>
                    <td className="max-w-64 truncate px-3 py-2 text-muted-foreground">{summary}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {qtyByVoucher.has(v.id) ? formatQty(qtyByVoucher.get(v.id)) : ""}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatWon(v.supply)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatWon(v.vat)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums">{formatWon(v.total)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">
                      <RowActions id={v.id} />
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">조건에 맞는 전표가 없어요.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </>
      )}
    </main>
  );
}

/** 품목·적요 없는 입금·출금: 여러 번 나눠 주고받았으면 금액을 이어서 보여준다 */
function moneySummary(label: string, amounts: number[]): string {
  if (amounts.length <= 1) return label;
  return `${label} ${amounts.length}회 (${amounts.map((a) => formatWon(a)).join(" + ")})`;
}

/** 경영박사 전표찾기의 기간 단추(오늘·전일·금주·전주·금월·전월·금년·전년) */
function quickRanges(today: string): [string, string, string][] {
  const d = new Date(`${today}T00:00:00Z`);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  const add = (x: Date, days: number) => new Date(x.getTime() + days * 86400000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const monday = add(d, -((d.getUTCDay() + 6) % 7));
  const monthStart = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));
  const monthEnd = (yy: number, mm: number) => new Date(Date.UTC(yy, mm + 1, 0));
  return [
    ["오늘", today, today],
    ["전일", iso(add(d, -1)), iso(add(d, -1))],
    ["금주", iso(monday), iso(add(monday, 6))],
    ["전주", iso(add(monday, -7)), iso(add(monday, -1))],
    ["금월", iso(monthStart(y, m)), iso(monthEnd(y, m))],
    ["전월", iso(monthStart(y, m - 1)), iso(monthEnd(y, m - 1))],
    ["금년", `${y}-01-01`, `${y}-12-31`],
    ["전년", `${y - 1}-01-01`, `${y - 1}-12-31`],
  ];
}
