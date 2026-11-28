"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EMPTY_ITEM, ItemForm } from "@/components/erp/item-manager";
import { PartnerForm } from "@/components/erp/partner-form";
import { CopyFromRecent, type CopiedLine } from "@/components/erp/copy-from-recent";
import { cn } from "@/lib/utils";
import { convertEstimateAction, deleteVoucherAction, saveVoucherAction } from "@/lib/erp/actions";
import { partnerDelta, salePriceFor, vatFor } from "@/lib/erp/compute";
import { formatQty, formatWon } from "@/lib/erp/format";
import {
  ITEMIZED_KINDS,
  PARTNER_KIND_LABEL,
  VOUCHER_KINDS,
  VOUCHER_KIND_LABEL,
  VAT_TYPE_LABEL,
  type ItemGroup,
  type Partner,
  type VoucherInput,
  type VoucherKind,
} from "@/lib/erp/types";
import type { ItemWithStock, PartnerWithBalance, RecentPrices, RecentVoucher } from "@/lib/erp/compute";

/** priceManual: 단가를 직접 고쳤으면 true — 거래처를 바꿔도 단가를 다시 매기지 않는다 */
type Line = VoucherInput["lines"][number] & { key: number; vatManual: boolean; priceManual: boolean };

export type VoucherFormProps = {
  partners: PartnerWithBalance[];
  items: ItemWithStock[];
  groups: ItemGroup[];
  /** 거래처·품목별 최근 단가 */
  recent?: RecentPrices;
  /** 매출↔매입 가져오기용 최근 전표 */
  recentVouchers?: RecentVoucher[];
  initial?: VoucherInput & { id: number; voucher_no: number; source_voucher_id: number | null };
  /** 이 견적에서 전환된 전표들(견적 화면에서 링크로 보여준다) */
  derived?: { id: number; kind: VoucherKind; voucher_date: string }[];
  defaultDate: string;
  defaultKind?: VoucherKind;
  defaultPartnerId?: number | null;
};

let keySeq = 1;
const emptyLine = (): Line => ({
  key: keySeq++,
  item_id: null,
  description: "",
  qty: 1,
  unit_price: 0,
  amount: 0,
  vat: 0,
  vatManual: false,
  priceManual: false,
});

export function VoucherForm({
  partners: partnersProp,
  items: itemsProp,
  groups,
  recent = {},
  recentVouchers = [],
  initial,
  derived = [],
  defaultDate,
  defaultKind = "sale",
  defaultPartnerId = null,
}: VoucherFormProps) {
  const router = useRouter();
  const [kind, setKind] = React.useState<VoucherKind>(initial?.kind ?? defaultKind);
  const [date, setDate] = React.useState(initial?.voucher_date ?? defaultDate);
  const [partnerId, setPartnerId] = React.useState<number | null>(initial?.partner_id ?? defaultPartnerId);
  const [cardPartnerId, setCardPartnerId] = React.useState<number | null>(initial?.card_partner_id ?? null);
  const [memo, setMemo] = React.useState(initial?.memo ?? "");
  const [lines, setLines] = React.useState<Line[]>(() =>
    initial?.lines.length
      ? initial.lines.map((l) => ({ ...l, key: keySeq++, vatManual: true, priceManual: true }))
      : [emptyLine()]
  );
  const [amountOnly, setAmountOnly] = React.useState<number>(() =>
    initial && !ITEMIZED_KINDS.includes(initial.kind)
      ? initial.lines.reduce((s, l) => s + l.amount + l.vat, 0)
      : 0
  );
  // 경영박사처럼 매출(매입) 전표를 쓰면서 그 자리에서 받은 돈(준 돈)도 함께 기록
  const [payAmount, setPayAmount] = React.useState(0);
  const [payMethod, setPayMethod] = React.useState<"현금" | "계좌이체" | "카드">("계좌이체");
  const [payCardId, setPayCardId] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  // 매출·견적에서 단가를 매입가보다 낮게 고쳤을 때 확인 창
  const [lowPrice, setLowPrice] = React.useState<{ key: number; prev: number; price: number; cost: number } | null>(null);
  const lowPriceOkRef = React.useRef(false);

  // 전표 입력 중 새로 등록한 거래처(서버 새로고침 전에도 바로 고를 수 있게)
  const [extraPartners, setExtraPartners] = React.useState<PartnerWithBalance[]>([]);
  const partners = React.useMemo(() => {
    const ids = new Set(partnersProp.map((p) => p.id));
    return [...partnersProp, ...extraPartners.filter((p) => !ids.has(p.id))];
  }, [partnersProp, extraPartners]);
  const [newPartner, setNewPartner] = React.useState<{ name: string; card: boolean } | null>(null);

  // 전표 입력 중 새로 등록한 품목(서버 새로고침 전에도 바로 고를 수 있게)
  const [extraItems, setExtraItems] = React.useState<ItemWithStock[]>([]);
  const items = React.useMemo(() => {
    const ids = new Set(itemsProp.map((i) => i.id));
    return [...itemsProp, ...extraItems.filter((i) => !ids.has(i.id))];
  }, [itemsProp, extraItems]);
  const [newItem, setNewItem] = React.useState<{ lineKey: number; name: string } | null>(null);

  const itemized = ITEMIZED_KINDS.includes(kind);
  const itemById = React.useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const partner = partners.find((p) => p.id === partnerId) ?? null;

  const partnerOptions = React.useMemo(
    () =>
      [...partners]
        .filter((p) => p.active || p.id === partnerId)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .map((p) => partnerOption(p)),
    [partners, partnerId]
  );
  const cardOptions = partners
    .filter((p) => p.kind === "card")
    .map((p) => partnerOption(p));
  const itemOptions = React.useMemo(
    () =>
      items
        .filter((i) => i.active)
        .sort((a, b) => a.name.localeCompare(b.name, "ko"))
        .map((i) => ({
          value: String(i.id),
          label: i.name,
          description: [i.spec, i.group_name, i.track_stock ? `재고 ${formatQty(i.stock)}` : null]
            .filter(Boolean)
            .join(" · "),
        })),
    [items]
  );

  const updateLine = (key: number, patch: Partial<Line>) => {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if ("qty" in patch || "unit_price" in patch) next.amount = Math.round(next.qty * next.unit_price);
        if (!next.vatManual && ("qty" in patch || "unit_price" in patch || "amount" in patch || "item_id" in patch)) {
          const vt = next.item_id ? (itemById.get(next.item_id)?.vat_type ?? 1) : 1;
          next.vat = vatFor(vt, next.amount);
        }
        return next;
      })
    );
  };

  const pickItem = (key: number, idStr: string) => {
    const item = itemById.get(Number(idStr));
    if (item) applyItem(key, item);
  };

  const applyItem = (key: number, item: ItemWithStock) => {
    const price = unitPriceFor(item, kind, partner);
    setLines((prev) => {
      const next = prev.map((l) => {
        if (l.key !== key) return l;
        const amount = Math.round((l.qty || 1) * price);
        return {
          ...l,
          item_id: item.id,
          description: "",
          qty: l.qty || 1,
          unit_price: price,
          amount,
          vat: vatFor(item.vat_type, amount),
          vatManual: false,
          priceManual: false,
        };
      });
      // 마지막 줄에서 품목을 고르면 빈 줄을 하나 더 붙여 입력 동선을 줄인다
      return next[next.length - 1].key === key ? [...next, emptyLine()] : next;
    });
  };

  /** 최근 매출(매입) 전표에서 체크한 줄을 지금 전표 끝(빈 줄 자리)에 붙인다 */
  const copyLines = (picked: CopiedLine[]) => {
    const added: Line[] = picked.map((src) => {
      const item = src.item_id ? itemById.get(src.item_id) : undefined;
      if (!item) {
        // 품목 없이 적요만 있던 줄은 금액까지 그대로
        return { ...emptyLine(), ...src, item_id: src.item_id, vatManual: true, priceManual: true };
      }
      const qty = src.qty || 1;
      const unit_price = unitPriceFor(item, kind, partner);
      const amount = Math.round(qty * unit_price);
      return {
        ...emptyLine(),
        item_id: item.id,
        description: src.description,
        qty,
        unit_price,
        amount,
        vat: vatFor(item.vat_type, amount),
      };
    });
    setLines((prev) => {
      const filled = prev.filter((l) => l.item_id != null || l.amount !== 0 || l.description.trim() !== "");
      return [...filled, ...added, emptyLine()];
    });
  };
  const copyFrom: "sale" | "purchase" | null = kind === "purchase" ? "sale" : kind === "sale" ? "purchase" : null;

  /** 거래처를 바꾸면 직접 고치지 않은 줄의 단가를 새 거래처 등급에 맞춰 다시 매긴다 */
  const changePartner = (id: number | null) => changePartnerTo(partners.find((p) => p.id === id) ?? null);
  const changePartnerTo = (next: PartnerWithBalance | null) => {
    setPartnerId(next?.id ?? null);
    setLines((prev) => prev.map((l) => repriceLine(l, kind, next)));
  };

  const repriceLine = (l: Line, k: VoucherKind, p: PartnerWithBalance | null): Line => {
    if (l.priceManual || !l.item_id) return l;
    const item = itemById.get(l.item_id);
    if (!item) return l;
    const unit_price = unitPriceFor(item, k, p);
    const amount = Math.round(l.qty * unit_price);
    return { ...l, unit_price, amount, vat: l.vatManual ? l.vat : vatFor(item.vat_type, amount) };
  };

  /** 종류를 바꿀 때 금액이 사라지지 않도록 품목 줄 합계 ↔ 금액 칸을 서로 옮겨 준다 */
  const changeKind = (next: VoucherKind) => {
    const wasItemized = ITEMIZED_KINDS.includes(kind);
    const willItemize = ITEMIZED_KINDS.includes(next);
    if (wasItemized && !willItemize) {
      const sum = lines.reduce((s, l) => s + l.amount + l.vat, 0);
      if (sum !== 0) setAmountOnly(sum);
    } else if (!wasItemized && willItemize && amountOnly !== 0) {
      const hasContent = lines.some((l) => l.item_id != null || l.amount !== 0 || l.description.trim() !== "");
      if (!hasContent) {
        setLines([{ ...emptyLine(), description: memo || VOUCHER_KIND_LABEL[kind], qty: 1, unit_price: amountOnly, amount: amountOnly, vat: 0, vatManual: true }]);
      }
    }
    // 매출↔매입처럼 가격 기준이 바뀌면 직접 고치지 않은 줄의 단가를 다시 매긴다
    if (willItemize) setLines((prev) => prev.map((l) => repriceLine(l, next, partner)));
    setKind(next);
  };

  const totals = itemized
    ? lines.reduce(
        (s, l) => ({ supply: s.supply + l.amount, vat: s.vat + l.vat }),
        { supply: 0, vat: 0 }
      )
    : { supply: amountOnly, vat: 0 };

  // 오른쪽 요약: 전잔액 → 이번 전표 → 함께 받은/준 돈 → 잔액 (받을 돈 +, 줄 돈 −)
  const withPayment = !initial && (kind === "sale" || kind === "purchase");
  const initialTotal = initial ? initial.lines.reduce((s, l) => s + l.amount + l.vat, 0) : 0;
  const prevBalance = partner
    ? partner.balance - (initial && initial.partner_id === partner.id ? partnerDelta(initial.kind, initialTotal) : 0)
    : 0;
  const thisDelta = partnerDelta(kind, totals.supply + totals.vat);
  const payDelta = withPayment && payAmount ? (kind === "sale" ? -payAmount : payAmount) : 0;
  const afterBalance = prevBalance + thisDelta + payDelta;

  const save = async () => {
    setSaving(true);
    setError(null);
    const input: VoucherInput = {
      id: initial?.id,
      voucher_date: date,
      kind,
      partner_id: partnerId,
      card_partner_id: cardPartnerId,
      memo,
      source_voucher_id: initial?.source_voucher_id ?? null,
      lines: itemized
        ? lines.map(({ item_id, description, qty, unit_price, amount, vat }) => ({
            item_id,
            description,
            qty,
            unit_price,
            amount,
            vat,
          }))
        : [
            {
              item_id: null,
              description: memo || VOUCHER_KIND_LABEL[kind],
              qty: 0,
              unit_price: 0,
              amount: amountOnly,
              vat: 0,
            },
          ],
    };
    const pay = withPayment && payAmount !== 0;
    if (pay && payMethod === "카드" && !payCardId) {
      setSaving(false);
      return setError("카드로 받은 돈은 카드사를 골라주세요.");
    }
    try {
      const res = await saveVoucherAction(input);
      if (!res.ok) return setError(res.error);
      if (pay) {
        const payKind: VoucherKind = kind === "purchase" ? "payment" : payMethod === "카드" ? "card_receipt" : "receipt";
        const payMemo = [payMethod, memo].filter(Boolean).join(" · ");
        const r2 = await saveVoucherAction({
          voucher_date: date,
          kind: payKind,
          partner_id: partnerId,
          card_partner_id: payKind === "card_receipt" ? payCardId : null,
          memo: payMemo,
          source_voucher_id: null,
          lines: [{ item_id: null, description: payMemo, qty: 0, unit_price: 0, amount: payAmount, vat: 0 }],
        });
        if (!r2.ok) {
          router.push(`/erp/vouchers/${res.id}?saved=1`);
          router.refresh();
          return setError(`전표는 저장됐지만 ${kind === "purchase" ? "출금" : "입금"} 기록은 실패했어요: ${r2.error}`);
        }
      }
      router.push(`/erp/vouchers/${res.id}?saved=1`);
      router.refresh();
    } catch {
      setError("저장 중 연결이 끊겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const convert = async (to: "sale" | "purchase") => {
    if (!initial) return;
    setSaving(true);
    setError(null);
    try {
      const res = await convertEstimateAction(initial.id, to);
      if (!res.ok) return setError(res.error);
      router.push(`/erp/vouchers/${res.id}?converted=1`);
      router.refresh();
    } catch {
      setError("전환 중 연결이 끊겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!initial) return;
    try {
      const res = await deleteVoucherAction(initial.id);
      if (!res.ok) return setError(res.error);
      router.push("/erp/vouchers");
      router.refresh();
    } catch {
      setError("삭제 중 연결이 끊겼어요. 잠시 후 다시 시도해주세요.");
    }
  };

  return (
    <div className={cn("grid gap-6", copyFrom && "xl:grid-cols-[minmax(0,1fr)_18rem]")}>
    <div className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-2xl font-semibold">
          {initial ? `${VOUCHER_KIND_LABEL[initial.kind]} 전표` : "전표 입력"}
        </h1>
        {initial && (
          <span className="text-sm text-muted-foreground">
            {initial.voucher_date} · {initial.voucher_no}번
          </span>
        )}
        {initial && (
          <div className="ml-auto flex flex-wrap gap-2 print:hidden">
            <Link
              href={`/erp/vouchers/${initial.id}/print`}
              className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
            >
              {initial.kind === "estimate" ? "견적서 출력·공유" : initial.kind === "sale" ? "거래명세서 출력·공유" : "출력·공유"}
            </Link>
            {initial.kind === "estimate" && (
              <>
                <Button variant="secondary" disabled={saving} onClick={() => convert("sale")}>매출로 전환</Button>
                <Button variant="secondary" disabled={saving} onClick={() => convert("purchase")}>매입으로 전환</Button>
              </>
            )}
            <Button variant="outline" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> 삭제
            </Button>
          </div>
        )}
      </div>

      {initial?.source_voucher_id && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          견적에서 전환된 전표예요.{" "}
          <Link className="underline" href={`/erp/vouchers/${initial.source_voucher_id}`}>원래 견적 보기</Link>
        </p>
      )}
      {derived.length > 0 && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          이 견적으로 만든 전표:{" "}
          {derived.map((d, i) => (
            <React.Fragment key={d.id}>
              {i > 0 && ", "}
              <Link className="underline" href={`/erp/vouchers/${d.id}`}>
                {VOUCHER_KIND_LABEL[d.kind]} {d.voucher_date}
              </Link>
            </React.Fragment>
          ))}
        </p>
      )}

      <div role="tablist" aria-label="전표 종류" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {VOUCHER_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={kind === k}
            onClick={() => changeKind(k)}
            className={cn(
              "min-h-9 rounded-md px-3 text-sm font-medium",
              kind === k ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {VOUCHER_KIND_LABEL[k]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">날짜</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="text-base sm:text-sm" />
        </label>
        <div className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{kind === "card_receipt" ? "결제한 거래처" : "거래처"}</span>
          <Combobox
            options={partnerOptions}
            value={partnerId ? String(partnerId) : ""}
            onChange={(v) => changePartner(v ? Number(v) : null)}
            placeholder="거래처 선택"
            searchPlaceholder="이름 검색 (초성 가능)"
            onCreateNew={(name) => setNewPartner({ name, card: false })}
            createPrompt="새로운 거래처입니다. 거래처를 등록할까요?"
          />
          {partner && (
            <span className="text-xs text-muted-foreground">
              {kind !== "purchase" && kind !== "payment" && `단가 ${partner.price_grade}등급 · `}
              현재 잔액 {formatWon(Math.abs(partner.balance))}원 {partner.balance > 0 ? "받을 돈" : partner.balance < 0 ? "줄 돈" : ""}
            </span>
          )}
        </div>
      </div>

      {kind === "card_receipt" && (
        <div className="flex flex-col gap-1 text-sm sm:max-w-sm">
          <span className="font-medium">카드사</span>
          <Combobox
            options={cardOptions}
            value={cardPartnerId ? String(cardPartnerId) : ""}
            onChange={(v) => setCardPartnerId(v ? Number(v) : null)}
            placeholder="카드사 선택"
            onCreateNew={(name) => setNewPartner({ name, card: true })}
            createPrompt="새로운 카드사입니다. 등록할까요?"
          />
          <span className="text-xs text-muted-foreground">거래처의 외상이 줄고, 같은 금액을 카드사에서 받을 돈으로 잡아요.</span>
        </div>
      )}

      {itemized ? (
        // 넓은 화면에서는 드롭다운이 표 밖으로 펼쳐지도록 overflow 를 풀고,
        // 좁은 화면(가로 스크롤 필요)에서는 드롭다운이 잘리지 않게 아래 여백을 둔다.
        <div className="overflow-x-auto rounded-lg border max-lg:pb-56 lg:overflow-visible">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-muted/50 text-left text-muted-foreground">
              <tr>
                <th className="w-[38%] px-2 py-2 font-medium">품목</th>
                <th className="px-2 py-2 text-right font-medium">수량</th>
                <th className="px-2 py-2 text-right font-medium">단가</th>
                <th className="px-2 py-2 text-right font-medium">공급가</th>
                <th className="px-2 py-2 text-right font-medium">부가세</th>
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {lines.map((l) => {
                const item = l.item_id ? itemById.get(l.item_id) : null;
                return (
                  <tr key={l.key} className="align-top">
                    <td className="px-2 py-2">
                      <Combobox
                        options={itemOptions}
                        value={l.item_id ? String(l.item_id) : ""}
                        onChange={(v) => pickItem(l.key, v)}
                        placeholder="품목 선택"
                        searchPlaceholder="품목 검색 (초성 가능)"
                        onCreateNew={(name) => setNewItem({ lineKey: l.key, name })}
                        createPrompt="새로운 품목입니다. 품목을 등록할까요?"
                      />
                      <Input
                        className="mt-1 h-8 text-xs"
                        placeholder={item ? "비고(선택)" : "품목 없이 적요만 입력해도 돼요"}
                        value={l.description}
                        onChange={(e) => updateLine(l.key, { description: e.target.value })}
                      />
                      {item && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {VAT_TYPE_LABEL[item.vat_type] ?? "면세"}
                          {kind !== "purchase" && ` · 판매가 A ${formatWon(item.sale_price)}`}
                          {kind !== "purchase" && item.sale_price_b != null && ` / B ${formatWon(item.sale_price_b)}`}
                          {kind !== "purchase" && item.sale_price_c != null && ` / C ${formatWon(item.sale_price_c)}`}
                          {item.track_stock && ` · 현재고 ${formatQty(item.stock)}`}
                        </div>
                      )}
                      {item && partnerId && (kind === "sale" || kind === "purchase" || kind === "estimate") && (() => {
                        const r = recent[`${kind === "purchase" ? "purchase" : "sale"}:${partnerId}:${item.id}`];
                        if (!r) return null;
                        return (
                          <button
                            type="button"
                            className="mt-1 block text-left text-xs text-sky-700 hover:underline dark:text-sky-400"
                            title="누르면 이 단가로 바꿔요"
                            onClick={() => updateLine(l.key, { unit_price: r.price, priceManual: true })}
                          >
                            최근 {kind === "purchase" ? "매입" : "판매"} {formatWon(r.price)}원 ({r.date.slice(2).replace(/-/g, ".")})
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-2 py-2">
                      <NumInput value={l.qty} onChange={(v) => updateLine(l.key, { qty: v })} className="w-20" />
                    </td>
                    <td className="px-2 py-2">
                      <NumInput
                        value={l.unit_price}
                        onChange={(v) => updateLine(l.key, { unit_price: v, priceManual: true })}
                        onCommit={(prev, next) => {
                          const cost = item?.purchase_price ?? 0;
                          if (kind !== "purchase" && item && cost > 0 && next < cost && next !== prev) {
                            setLowPrice({ key: l.key, prev, price: next, cost });
                          }
                        }}
                        className="w-28"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <NumInput value={l.amount} onChange={(v) => updateLine(l.key, { amount: v })} className="w-32" />
                    </td>
                    <td className="px-2 py-2">
                      <NumInput
                        value={l.vat}
                        onChange={(v) => updateLine(l.key, { vat: v, vatManual: true })}
                        className="w-24"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        aria-label="줄 삭제"
                        onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((x) => x.key !== l.key) : [emptyLine()]))}
                        className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" onClick={() => setLines((p) => [...p, emptyLine()])}>
              <Plus /> 줄 추가
            </Button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm sm:max-w-sm">
          <span className="font-medium">금액</span>
          <NumInput value={amountOnly} onChange={setAmountOnly} className="text-lg" />
        </label>
      )}

      {withPayment && (
        <fieldset className="flex flex-wrap items-end gap-3 rounded-lg border border-dashed p-3 text-sm">
          <legend className="px-1 font-medium">
            {kind === "sale" ? "이번에 함께 받은 돈(입금)" : "이번에 함께 준 돈(출금)"}{" "}
            <span className="font-normal text-muted-foreground">— 없으면 비워 두세요</span>
          </legend>
          <label className="flex flex-col gap-1">
            <span className="text-muted-foreground">금액</span>
            <NumInput value={payAmount} onChange={setPayAmount} className="w-40" />
          </label>
          <button
            type="button"
            className="h-9 rounded-md border px-3 hover:bg-accent"
            onClick={() => setPayAmount(totals.supply + totals.vat)}
          >
            전액
          </button>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">방법</span>
            <div className="flex gap-1">
              {(kind === "sale" ? (["현금", "계좌이체", "카드"] as const) : (["현금", "계좌이체"] as const)).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={payMethod === m}
                  onClick={() => setPayMethod(m)}
                  className={cn(
                    "h-9 rounded-md border px-3",
                    payMethod === m ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          {kind === "sale" && payMethod === "카드" && (
            <div className="flex min-w-48 flex-col gap-1">
              <span className="text-muted-foreground">카드사</span>
              <Combobox
                options={cardOptions}
                value={payCardId ? String(payCardId) : ""}
                onChange={(v) => setPayCardId(v ? Number(v) : null)}
                placeholder="카드사 선택"
              />
            </div>
          )}
          <p className="basis-full text-xs text-muted-foreground">
            저장하면 같은 날짜로 {kind === "sale" ? "입금" : "출금"} 전표가 따로 하나 더 생기고, 거래처원장에 함께 나와요.
          </p>
        </fieldset>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">적요(메모)</span>
        <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 계좌이체, 현금" className="text-base sm:text-sm" />
      </label>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <div className="text-sm">
          공급가 <b className="tabular-nums">{formatWon(totals.supply)}</b> · 부가세{" "}
          <b className="tabular-nums">{formatWon(totals.vat)}</b> · 합계{" "}
          <b className="text-base tabular-nums">{formatWon(totals.supply + totals.vat)}원</b>
        </div>
        {partner && kind !== "estimate" && (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="잔액 계산">
            <BalanceCell label="전잔액" v={prevBalance} />
            <BalanceCell label={VOUCHER_KIND_LABEL[kind]} v={thisDelta} signed />
            {payDelta !== 0 && <BalanceCell label={kind === "sale" ? "입금" : "출금"} v={payDelta} signed />}
            <BalanceCell label="잔액" v={afterBalance} strong />
          </dl>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button className="ml-auto h-10 px-6" disabled={saving} onClick={save}>
          {saving ? "저장 중…" : initial ? "수정 저장" : "저장"}
        </Button>
      </div>
    </div>

      {copyFrom && (
        <CopyFromRecent
          from={copyFrom}
          vouchers={recentVouchers}
          itemById={itemById}
          onCopy={copyLines}
          className="xl:sticky xl:top-4 xl:self-start"
        />
      )}

      <Dialog open={newPartner != null} onOpenChange={(o) => !o && setNewPartner(null)} widthClassName="max-w-2xl">
        {newPartner && (
          <DialogContent onClose={() => setNewPartner(null)}>
            <DialogHeader>
              <DialogTitle>{newPartner.card ? "새 카드사 등록" : "새 거래처 등록"}</DialogTitle>
            </DialogHeader>
            <PartnerForm
              initial={{
                name: newPartner.name,
                kind: newPartner.card ? "card" : kind === "purchase" || kind === "payment" ? "supplier" : "customer",
              }}
              onDone={(id, saved) => {
                const created: PartnerWithBalance = {
                  ...saved,
                  id,
                  legacy_code: null,
                  balance: Number(saved.opening_balance) || 0,
                  last_date: null,
                };
                setExtraPartners((prev) => [...prev, created]);
                if (newPartner.card) setCardPartnerId(id);
                else changePartnerTo(created);
                setNewPartner(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>

      <Dialog open={newItem != null} onOpenChange={(o) => !o && setNewItem(null)} widthClassName="max-w-xl">
        {newItem && (
          <DialogContent onClose={() => setNewItem(null)}>
            <DialogHeader>
              <DialogTitle>새 품목 등록</DialogTitle>
            </DialogHeader>
            <ItemForm
              initial={{ ...EMPTY_ITEM, name: newItem.name }}
              groups={groups}
              currentStock={null}
              onDone={(id, saved) => {
                const created: ItemWithStock = {
                  ...saved,
                  id,
                  legacy_code: null,
                  stock: saved.track_stock ? saved.opening_stock : null,
                  group_name: groups.find((g) => g.id === saved.group_id)?.name ?? null,
                };
                setExtraItems((prev) => [...prev, created]);
                applyItem(newItem.lineKey, created);
                setNewItem(null);
              }}
            />
          </DialogContent>
        )}
      </Dialog>

      <ConfirmDialog
        open={lowPrice != null}
        onOpenChange={(o) => {
          if (o) return;
          // [계속]이 아니라 취소·닫기로 닫으면 원래 단가로 되돌린다
          if (!lowPriceOkRef.current && lowPrice) updateLine(lowPrice.key, { unit_price: lowPrice.prev });
          lowPriceOkRef.current = false;
          setLowPrice(null);
        }}
        title="매입가보다 낮은 금액입니다. 계속하시겠습니까?"
        description={
          lowPrice
            ? `입력한 단가 ${formatWon(lowPrice.price)}원이 매입가 ${formatWon(lowPrice.cost)}원보다 ${formatWon(lowPrice.cost - lowPrice.price)}원 낮아요. 취소하면 원래 단가(${formatWon(lowPrice.prev)}원)로 돌아가요.`
            : ""
        }
        confirmLabel="계속"
        variant="default"
        onConfirm={() => {
          lowPriceOkRef.current = true;
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="전표를 삭제할까요?"
        description="삭제하면 잔액과 재고에서도 빠지고, 되돌릴 수 없어요."
        confirmLabel="삭제"
        onConfirm={remove}
      />
    </div>
  );
}

function BalanceCell({ label, v, signed, strong }: { label: string; v: number; signed?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("tabular-nums", strong && "font-semibold", v < 0 && "text-red-600")}>
        {signed && v > 0 ? "+" : ""}
        {formatWon(v)}
      </dd>
    </div>
  );
}

/** 매입은 매입가, 매출·견적은 거래처 단가 등급의 판매가 */
function unitPriceFor(item: ItemWithStock, kind: VoucherKind, partner: PartnerWithBalance | null): number {
  return kind === "purchase" ? item.purchase_price : salePriceFor(item, partner?.price_grade);
}

function NumInput({
  value,
  onChange,
  onCommit,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  /** 입력을 마쳤을 때(포커스가 빠질 때) 고치기 전 값과 새 값 */
  onCommit?: (prev: number, next: number) => void;
  className?: string;
}) {
  const [text, setText] = React.useState(formatQty(value));
  const [focused, setFocused] = React.useState(false);
  const startRef = React.useRef(value);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!focused) setText(formatQty(value));
  }, [value, focused]);
  return (
    <Input
      inputMode="decimal"
      className={cn("text-right tabular-nums text-base sm:text-sm", className)}
      value={text}
      onFocus={() => {
        startRef.current = value;
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
        onCommit?.(startRef.current, value);
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value.replace(/,/g, ""));
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  );
}

export type { Partner };

/** 거래처 선택 목록: 회사명·대표자명·담당자명(·전화)으로 찾을 수 있게 */
function partnerOption(p: PartnerWithBalance) {
  const people = [p.rep_name && `대표 ${p.rep_name}`, p.contact && `담당 ${p.contact}`].filter(Boolean).join(" · ");
  return {
    value: String(p.id),
    label: p.name,
    description: [PARTNER_KIND_LABEL[p.kind], people].filter(Boolean).join(" · "),
    keywords: [p.rep_name, p.contact, p.tel, p.mobile].filter(Boolean).join(" "),
  };
}
