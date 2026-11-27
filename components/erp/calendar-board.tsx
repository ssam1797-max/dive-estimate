"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { changeVouchersAction } from "@/lib/erp/actions";
import { formatWon } from "@/lib/erp/format";
import { VOUCHER_KIND_LABEL, type VoucherKind } from "@/lib/erp/types";
import { KindBadge } from "@/components/erp/kind-badge";

export type DayVoucher = {
  id: number;
  date: string;
  no: number;
  kind: VoucherKind;
  partner: string;
  summary: string;
  total: number;
};

const DOT: Record<VoucherKind, string> = {
  sale: "bg-sky-600",
  purchase: "bg-amber-500",
  receipt: "bg-emerald-600",
  payment: "bg-rose-600",
  card_receipt: "bg-violet-600",
  estimate: "bg-slate-400",
};

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 경영박사 메인 달력: 거래가 있는 날은 점, 날짜를 누르면 그날 전표 목록,
 * 목록에서 골라 날짜·종류(매출↔매입, 입금↔출금)를 한꺼번에 바꿀 수 있다.
 */
export function CalendarBoard({
  month,
  today,
  selectedDay,
  vouchers,
}: {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD
  selectedDay: string | null;
  vouchers: DayVoucher[]; // 이 달의 전표(견적 포함)
}) {
  const router = useRouter();
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = first.getUTCDay();
  const byDay = React.useMemo(() => {
    const map = new Map<string, DayVoucher[]>();
    for (const v of vouchers) {
      const arr = map.get(v.date) ?? [];
      arr.push(v);
      map.set(v.date, arr);
    }
    return map;
  }, [vouchers]);

  const go = (params: { month?: string; day?: string | null }) => {
    const sp = new URLSearchParams();
    sp.set("month", params.month ?? month);
    const d = params.day === undefined ? selectedDay : params.day;
    if (d) sp.set("day", d);
    router.push(`/erp?${sp.toString()}`, { scroll: false });
  };
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    go({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`, day: null });
  };

  const cells: (string | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(`${month}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);

  const dayList = selectedDay ? (byDay.get(selectedDay) ?? []) : [];

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" aria-label="이전 달" onClick={() => shift(-1)} className="flex size-9 items-center justify-center rounded-md hover:bg-accent">
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tabular-nums">
              {y}년 {m}월
            </span>
            {month !== today.slice(0, 7) && (
              <button type="button" onClick={() => go({ month: today.slice(0, 7), day: today })} className="rounded-md border px-2 py-0.5 text-xs hover:bg-accent">
                오늘
              </button>
            )}
          </div>
          <button type="button" aria-label="다음 달" onClick={() => shift(1)} className="flex size-9 items-center justify-center rounded-md hover:bg-accent">
            <ChevronRight className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
          {WEEK.map((w, i) => (
            <div key={w} className={cn("py-1", i === 0 && "text-rose-600", i === 6 && "text-sky-600")}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={`e${i}`} />;
            const list = byDay.get(d) ?? [];
            const kinds = [...new Set(list.map((v) => v.kind))];
            const isSel = d === selectedDay;
            const isToday = d === today;
            const dow = i % 7;
            return (
              <button
                key={d}
                type="button"
                onClick={() => go({ day: d })}
                aria-pressed={isSel}
                aria-label={`${Number(d.slice(8))}일${list.length ? `, 거래 ${list.length}건` : ""}`}
                className={cn(
                  "flex h-14 flex-col items-center justify-start rounded-md pt-1.5 text-sm transition-colors hover:bg-accent",
                  isSel && "bg-primary text-primary-foreground hover:bg-primary/90",
                  !isSel && isToday && "ring-1 ring-primary"
                )}
              >
                <span className={cn("tabular-nums", !isSel && dow === 0 && "text-rose-600", !isSel && dow === 6 && "text-sky-600")}>
                  {Number(d.slice(8))}
                </span>
                {list.length > 0 && (
                  <span className="mt-1 flex gap-0.5">
                    {kinds.slice(0, 4).map((k) => (
                      <span key={k} className={cn("size-1.5 rounded-full", isSel ? "bg-primary-foreground" : DOT[k])} />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {(["sale", "purchase", "receipt", "payment", "estimate"] as VoucherKind[]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className={cn("size-1.5 rounded-full", DOT[k])} />
              {VOUCHER_KIND_LABEL[k]}
            </span>
          ))}
        </div>
      </div>

      <DayPanel key={selectedDay ?? "none"} day={selectedDay} list={dayList} />
    </section>
  );
}

function DayPanel({ day, list }: { day: string | null; list: DayVoucher[] }) {
  const router = useRouter();
  const [picked, setPicked] = React.useState<Set<number>>(new Set());
  const [newDate, setNewDate] = React.useState(day ?? "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<{ ok: boolean; text: string } | null>(null);

  if (!day) {
    return (
      <div className="flex items-center justify-center rounded-lg border p-6 text-sm text-muted-foreground">
        달력에서 날짜를 누르면 그날 거래가 여기에 나와요.
      </div>
    );
  }

  const pickedList = list.filter((v) => picked.has(v.id));
  const allItems = pickedList.length > 0 && pickedList.every((v) => v.kind === "sale" || v.kind === "purchase" || v.kind === "estimate");
  const allMoney = pickedList.length > 0 && pickedList.every((v) => v.kind === "receipt" || v.kind === "payment");
  const toggle = (id: number) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async (change: { date?: string; kind?: VoucherKind }, label: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await changeVouchersAction([...picked], change);
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      setMsg({ ok: true, text: `${res.id}건을 ${label}(으)로 바꿨어요.` });
      setPicked(new Set());
      router.refresh();
    } catch {
      setMsg({ ok: false, text: "연결이 끊겼어요. 잠시 후 다시 시도해주세요." });
    } finally {
      setBusy(false);
    }
  };

  const [, mm, dd] = day.split("-");
  const total = (k: VoucherKind[]) => list.filter((v) => k.includes(v.kind)).reduce((s, v) => s + v.total, 0);

  return (
    <div className="flex flex-col rounded-lg border">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-3 py-2.5">
        <h2 className="text-lg font-semibold">
          {Number(mm)}월 {Number(dd)}일 거래 {list.length}건
        </h2>
        <span className="text-xs text-muted-foreground">
          매출 {formatWon(total(["sale"]))} · 매입 {formatWon(total(["purchase"]))} · 입금 {formatWon(total(["receipt", "card_receipt"]))} · 출금 {formatWon(total(["payment"]))}
        </span>
        <Link href={`/erp/vouchers/new?date=${day}`} className="ml-auto text-sm font-medium text-primary hover:underline">
          + 이 날짜로 입력
        </Link>
      </div>

      {list.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">이 날은 거래가 없어요.</p>
      ) : (
        <ul className="divide-y">
          {list.map((v) => (
            <li key={v.id} className={cn("flex items-center gap-2 px-3 py-2", picked.has(v.id) && "bg-accent/60")}>
              <input
                type="checkbox"
                className="size-4 shrink-0"
                aria-label={`${v.partner} ${VOUCHER_KIND_LABEL[v.kind]} 선택`}
                checked={picked.has(v.id)}
                onChange={() => toggle(v.id)}
              />
              <KindBadge kind={v.kind} />
              <Link href={`/erp/vouchers/${v.id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:underline">
                <span className="shrink-0 font-medium">{v.partner}</span>
                <span className="min-w-0 truncate text-sm text-muted-foreground">{v.summary}</span>
              </Link>
              <span className="shrink-0 text-sm tabular-nums">{formatWon(v.total)}</span>
            </li>
          ))}
        </ul>
      )}

      {list.length > 0 && (
        <div className="mt-auto flex flex-col gap-2 border-t bg-muted/30 p-3 text-sm">
          <div className="text-muted-foreground">
            {picked.size === 0 ? "고칠 거래 앞의 칸을 체크하세요." : `${picked.size}건 선택`}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
              aria-label="옮길 날짜"
            />
            <Button
              variant="outline"
              disabled={busy || picked.size === 0 || !newDate || newDate === day}
              onClick={() => run({ date: newDate }, newDate)}
            >
              날짜 변경
            </Button>
            <span className="mx-1 h-5 w-px bg-border" />
            {allItems && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => run({ kind: "sale" }, "매출")}>매출로</Button>
                <Button variant="outline" disabled={busy} onClick={() => run({ kind: "purchase" }, "매입")}>매입으로</Button>
              </>
            )}
            {allMoney && (
              <>
                <Button variant="outline" disabled={busy} onClick={() => run({ kind: "receipt" }, "입금")}>입금으로</Button>
                <Button variant="outline" disabled={busy} onClick={() => run({ kind: "payment" }, "출금")}>출금으로</Button>
              </>
            )}
            {picked.size > 0 && !allItems && !allMoney && (
              <span className="text-xs text-muted-foreground">종류 변경은 매출·매입끼리, 입금·출금끼리 골랐을 때만 돼요.</span>
            )}
          </div>
          {msg && <p className={msg.ok ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}>{msg.text}</p>}
        </div>
      )}
    </div>
  );
}
