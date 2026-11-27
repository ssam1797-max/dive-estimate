import Link from "next/link";
import { Share2 } from "lucide-react";
import { loadErpData } from "@/lib/erp/repo";
import { voucherTotals } from "@/lib/erp/compute";
import { formatDate, formatQty, formatWon, todayKST } from "@/lib/erp/format";
import { VOUCHER_KINDS, VOUCHER_KIND_LABEL, type VoucherKind } from "@/lib/erp/types";
import { KindBadge } from "@/components/erp/kind-badge";
import { RunningTable } from "@/components/erp/running-table";
import { RowActions } from "@/components/erp/row-actions";
import { partnerRunning } from "@/lib/erp/running";

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
      const hay = [partnerName.get(v.partner_id ?? -1), v.memo, ...(linesByVoucher.get(v.id) ?? [])].join(" ");
      return hay.toLowerCase().includes(q.toLowerCase());
    })
    .sort((a, b) =>
      a.voucher_date === b.voucher_date ? b.voucher_no - a.voucher_no : a.voucher_date < b.voucher_date ? 1 : -1
    );
  // 거래처를 고르면 경영박사처럼 품목 줄마다 누적 잔액을 보여준다(견적 제외)
  const running = partnerId && kind !== "estimate" ? partnerRunning(data, partnerId, from, to) : null;

  // 견적은 장부(매출·매입·잔액)에 반영되지 않으므로 합계에서 따로 보여준다
  const total = rows.filter((r) => r.kind !== "estimate").reduce((s, r) => s + r.total, 0);
  const estimateTotal = rows.filter((r) => r.kind === "estimate").reduce((s, r) => s + r.total, 0);

  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">전표</h1>
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
        <label className="flex flex-col gap-1">
          <span className="text-muted-foreground">거래처</span>
          <select name="partner" defaultValue={partnerId ?? ""} className="h-9 max-w-48 rounded-md border bg-background px-2 text-base sm:text-sm">
            <option value="">전체</option>
            {[...data.partners].sort((a, b) => a.name.localeCompare(b.name, "ko")).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1">
          <span className="text-muted-foreground">검색(품목·적요)</span>
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
