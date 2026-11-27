"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { matchesKoreanSearch } from "@/lib/hangul";
import { saveItemAction } from "@/lib/erp/actions";
import { formatQty, formatWon } from "@/lib/erp/format";
import { VAT_TYPE_LABEL, type ItemGroup, type ItemInput } from "@/lib/erp/types";
import type { ItemWithStock } from "@/lib/erp/compute";
import { cn } from "@/lib/utils";

export const EMPTY_ITEM: ItemInput = {
  sku: null,
  group_id: null,
  name: "",
  spec: null,
  unit: "EA",
  purchase_price: 0,
  sale_price: 0,
  vat_type: 1,
  memo: null,
  active: true,
  track_stock: false,
  opening_stock: 0,
};

export function ItemManager({ items, groups }: { items: ItemWithStock[]; groups: ItemGroup[] }) {
  const [q, setQ] = React.useState("");
  const [group, setGroup] = React.useState<string>("");
  const [onlyStock, setOnlyStock] = React.useState(false);
  const [showInactive, setShowInactive] = React.useState(false);
  const [editing, setEditing] = React.useState<ItemInput | null>(null);

  const rows = items
    .filter((i) => showInactive || i.active)
    .filter((i) => !group || String(i.group_id) === group)
    .filter((i) => !onlyStock || i.track_stock)
    .filter((i) => !q.trim() || matchesKoreanSearch(`${i.name} ${i.spec ?? ""}`, q))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-2xl font-semibold">품목·재고</h1>
        <Button onClick={() => setEditing({ ...EMPTY_ITEM })}>+ 품목 추가</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Input placeholder="품목 검색 (초성 가능)" value={q} onChange={(e) => setQ(e.target.value)} className="w-56 text-base sm:text-sm" />
        <Select value={group} onChange={(e) => setGroup(e.target.value)} className="w-40 text-base sm:text-sm">
          <option value="">전체 분류</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4" checked={onlyStock} onChange={(e) => setOnlyStock(e.target.checked)} />
          재고관리 품목만
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="size-4" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          사용 안 함 포함
        </label>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">품목</th>
              <th className="px-3 py-2 font-medium">분류</th>
              <th className="px-3 py-2 font-medium">과세</th>
              <th className="px-3 py-2 text-right font-medium">매입가</th>
              <th className="px-3 py-2 text-right font-medium">판매가</th>
              <th className="px-3 py-2 text-right font-medium">현재고</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((i) => (
              <tr key={i.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setEditing({ ...i })}>
                <td className="px-3 py-2">
                  <span className="font-medium">{i.name}</span>
                  {i.spec && <span className="text-muted-foreground"> · {i.spec}</span>}
                  {!i.active && <span className="ml-2 text-xs text-muted-foreground">(사용 안 함)</span>}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{i.group_name}</td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{VAT_TYPE_LABEL[i.vat_type] ?? ""}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatWon(i.purchase_price)}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatWon(i.sale_price)}</td>
                <td className={cn("whitespace-nowrap px-3 py-2 text-right tabular-nums", (i.stock ?? 0) < 0 && "text-rose-700 dark:text-rose-400")}>
                  {i.track_stock ? `${formatQty(i.stock)} ${i.unit ?? ""}` : <span className="text-muted-foreground">관리 안 함</span>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">조건에 맞는 품목이 없어요.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={editing != null} onOpenChange={(o) => !o && setEditing(null)} widthClassName="max-w-xl">
        {editing && (
          <DialogContent onClose={() => setEditing(null)}>
            <DialogHeader>
              <DialogTitle>{editing.id ? "품목 수정" : "품목 추가"}</DialogTitle>
            </DialogHeader>
            <ItemForm
              initial={editing}
              groups={groups}
              currentStock={editing.id ? (items.find((x) => x.id === editing.id)?.stock ?? null) : null}
              onDone={() => setEditing(null)}
            />
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

export function ItemForm({
  initial,
  groups,
  currentStock,
  onDone,
}: {
  initial: ItemInput;
  groups: ItemGroup[];
  currentStock: number | null;
  onDone: (id: number, saved: ItemInput) => void;
}) {
  const router = useRouter();
  const [f, setF] = React.useState<ItemInput>(initial);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const set = <K extends keyof ItemInput>(k: K, v: ItemInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const num = (s: string) => Number(s.replace(/,/g, "")) || 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await saveItemAction(f);
      if (!res.ok) return setError(res.error);
      router.refresh();
      onDone(res.id, f);
    } catch {
      setError("저장 중 연결이 끊겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="font-medium">품목명 *</span>
        <Input value={f.name} onChange={(e) => set("name", e.target.value)} required className="text-base sm:text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">규격</span>
        <Input value={f.spec ?? ""} onChange={(e) => set("spec", e.target.value)} className="text-base sm:text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">분류</span>
        <Select value={f.group_id ?? ""} onChange={(e) => set("group_id", e.target.value ? Number(e.target.value) : null)} className="text-base sm:text-sm">
          <option value="">없음</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">매입가</span>
        <Input inputMode="decimal" value={String(f.purchase_price)} onChange={(e) => set("purchase_price", num(e.target.value))} className="text-right text-base tabular-nums sm:text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">판매가</span>
        <Input inputMode="decimal" value={String(f.sale_price)} onChange={(e) => set("sale_price", num(e.target.value))} className="text-right text-base tabular-nums sm:text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">과세 구분</span>
        <Select value={String(f.vat_type)} onChange={(e) => set("vat_type", Number(e.target.value))} className="text-base sm:text-sm">
          <option value="0">과세 (부가세 10%)</option>
          <option value="1">면세</option>
          <option value="3">영세</option>
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">단위</span>
        <Input value={f.unit ?? ""} onChange={(e) => set("unit", e.target.value)} className="text-base sm:text-sm" />
      </label>

      <fieldset className="rounded-md border p-3 sm:col-span-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" className="size-4" checked={f.track_stock} onChange={(e) => set("track_stock", e.target.checked)} />
          재고관리 하기
        </label>
        <p className="mt-1 text-xs text-muted-foreground">켜면 매입할 때 재고가 늘고, 매출할 때 줄어요. 교육·택배비처럼 재고가 없는 품목은 꺼 두세요.</p>
        {f.track_stock && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">기초재고</span>
              <Input inputMode="decimal" value={String(f.opening_stock)} onChange={(e) => set("opening_stock", num(e.target.value))} className="w-32 text-right text-base tabular-nums sm:text-sm" />
            </label>
            {currentStock != null && (
              <span className="pb-2 text-sm text-muted-foreground">저장 전 현재고 {formatQty(currentStock)}</span>
            )}
          </div>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
        <span className="text-muted-foreground">메모</span>
        <Input value={f.memo ?? ""} onChange={(e) => set("memo", e.target.value)} className="text-base sm:text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4" checked={f.active} onChange={(e) => set("active", e.target.checked)} />
        사용 중
      </label>
      <div className="flex items-center justify-end gap-3 sm:col-span-2">
        {error && <span className="text-sm text-destructive">{error}</span>}
        <Button type="submit" disabled={saving}>{saving ? "저장 중…" : "저장"}</Button>
      </div>
    </form>
  );
}
