"use client";

import * as React from "react";
import { ChevronDown, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatQty, formatWon } from "@/lib/erp/format";
import type { ItemWithStock, RecentVoucher } from "@/lib/erp/compute";

export type CopiedLine = RecentVoucher["lines"][number];

/**
 * 매입 전표를 쓸 때는 최근 매출 전표를, 매출 전표를 쓸 때는 최근 매입 전표를
 * 옆에 보여 주고, 체크한 품목 줄을 지금 전표로 바로 가져온다.
 * (주문 받아 매출 기록 → 같은 물건을 다시 주문해 매입 기록, 또는 그 반대)
 */
export function CopyFromRecent({
  from,
  vouchers,
  itemById,
  onCopy,
  className,
}: {
  /** 가져올 전표 종류(지금 쓰는 전표의 반대) */
  from: "sale" | "purchase";
  vouchers: RecentVoucher[];
  itemById: Map<number, ItemWithStock>;
  onCopy: (lines: CopiedLine[]) => void;
  className?: string;
}) {
  const list = React.useMemo(() => vouchers.filter((v) => v.kind === from), [vouchers, from]);
  // 체크 상태: "전표id:줄번호"
  const [checked, setChecked] = React.useState<Set<string>>(new Set());
  const [openId, setOpenId] = React.useState<number | null>(() => list[0]?.id ?? null);
  const [prevFrom, setPrevFrom] = React.useState(from);
  if (prevFrom !== from) {
    setPrevFrom(from);
    setChecked(new Set());
    setOpenId(list[0]?.id ?? null);
  }

  const label = from === "sale" ? "매출" : "매입";
  const k = (vid: number, i: number) => `${vid}:${i}`;

  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleVoucher = (v: RecentVoucher) =>
    setChecked((prev) => {
      const keys = v.lines.map((_, i) => k(v.id, i));
      const all = keys.every((x) => prev.has(x));
      const next = new Set(prev);
      for (const x of keys) {
        if (all) next.delete(x);
        else next.add(x);
      }
      return next;
    });

  const copy = () => {
    const picked: CopiedLine[] = [];
    for (const v of list) v.lines.forEach((l, i) => checked.has(k(v.id, i)) && picked.push(l));
    if (!picked.length) return;
    onCopy(picked);
    setChecked(new Set());
  };

  const lineName = (l: CopiedLine) =>
    (l.item_id ? itemById.get(l.item_id)?.name : null) ?? (l.description || "(적요 없음)");

  return (
    <aside className={cn("flex flex-col rounded-lg border bg-card text-sm print:hidden", className)}>
      <div className="border-b px-3 py-2">
        <div className="font-medium">최근 {label}에서 가져오기</div>
        <p className="text-xs text-muted-foreground">체크한 품목이 아래 줄에 추가돼요. 단가는 지금 전표 기준으로 다시 매겨요.</p>
      </div>
      {list.length === 0 ? (
        <p className="px-3 py-4 text-center text-muted-foreground">최근 {label} 전표가 없어요.</p>
      ) : (
        <ul className="max-h-[28rem] divide-y overflow-y-auto">
          {list.map((v) => {
            const keys = v.lines.map((_, i) => k(v.id, i));
            const n = keys.filter((x) => checked.has(x)).length;
            const open = openId === v.id;
            const total = v.lines.reduce((s, l) => s + l.amount + l.vat, 0);
            return (
              <li key={v.id}>
                <div className="flex items-center gap-2 px-3 py-2">
                  <input
                    type="checkbox"
                    aria-label={`${v.voucher_date} ${v.partner_name ?? ""} 전체 선택`}
                    className="size-4 shrink-0 accent-primary"
                    checked={n > 0 && n === keys.length}
                    ref={(el) => {
                      if (el) el.indeterminate = n > 0 && n < keys.length;
                    }}
                    onChange={() => toggleVoucher(v)}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : v.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{v.partner_name ?? "거래처 없음"}</span>
                      <span className="block text-xs text-muted-foreground">
                        {v.voucher_date.slice(2).replace(/-/g, ".")} · {v.lines.length}줄 · {formatWon(total)}원
                      </span>
                    </span>
                    <ChevronDown className={cn("size-4 shrink-0 opacity-50 transition-transform", open && "rotate-180")} />
                  </button>
                </div>
                {open && (
                  <ul className="pb-2">
                    {v.lines.map((l, i) => (
                      <li key={i}>
                        <label className="flex cursor-pointer items-start gap-2 py-1 pl-9 pr-3 hover:bg-accent/50">
                          <input
                            type="checkbox"
                            className="mt-0.5 size-4 shrink-0 accent-primary"
                            checked={checked.has(k(v.id, i))}
                            onChange={() => toggle(k(v.id, i))}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{lineName(l)}</span>
                            <span className="block text-xs tabular-nums text-muted-foreground">
                              {formatQty(l.qty)} × {formatWon(l.unit_price)}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="border-t p-2">
        <Button className="w-full" size="sm" disabled={checked.size === 0} onClick={copy}>
          <Download /> {checked.size ? `체크한 ${checked.size}개 가져오기` : "품목을 체크하세요"}
        </Button>
      </div>
    </aside>
  );
}
