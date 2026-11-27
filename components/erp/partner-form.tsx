"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { savePartnerAction } from "@/lib/erp/actions";
import { PARTNER_KINDS, PARTNER_KIND_LABEL, PRICE_GRADES, type Partner, type PartnerInput } from "@/lib/erp/types";

const EMPTY: PartnerInput = {
  name: "",
  kind: "customer",
  biz_no: null,
  rep_name: null,
  biz_type: null,
  biz_item: null,
  zip: null,
  address: null,
  tel: null,
  mobile: null,
  fax: null,
  email: null,
  contact: null,
  bank: null,
  bank_account: null,
  bank_holder: null,
  memo: null,
  opening_balance: 0,
  active: true,
  price_grade: "A",
};

const FIELDS: { key: keyof PartnerInput; label: string; wide?: boolean }[] = [
  { key: "biz_no", label: "사업자번호" },
  { key: "rep_name", label: "대표자" },
  { key: "biz_type", label: "업태" },
  { key: "biz_item", label: "종목" },
  { key: "tel", label: "전화" },
  { key: "mobile", label: "휴대폰" },
  { key: "email", label: "이메일" },
  { key: "contact", label: "담당자" },
  { key: "address", label: "주소", wide: true },
  { key: "bank", label: "은행" },
  { key: "bank_account", label: "계좌번호" },
  { key: "bank_holder", label: "예금주" },
  { key: "memo", label: "메모", wide: true },
];

export function PartnerForm({ partner, onDone }: { partner?: Partner; onDone?: (id: number) => void }) {
  const router = useRouter();
  const [form, setForm] = React.useState<PartnerInput>(() => (partner ? { ...partner } : { ...EMPTY }));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const set = (k: keyof PartnerInput, v: unknown) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await savePartnerAction(form);
      if (!res.ok) return setError(res.error);
      setSaved(true);
      router.refresh();
      onDone?.(res.id);
    } catch {
      setError("저장 중 연결이 끊겼어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">상호(이름) *</span>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} required className="text-base sm:text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">구분</span>
        <Select value={form.kind} onChange={(e) => set("kind", e.target.value)} className="text-base sm:text-sm">
          {PARTNER_KINDS.map((k) => (
            <option key={k} value={k}>{PARTNER_KIND_LABEL[k]}</option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">단가 등급</span>
        <Select value={form.price_grade} onChange={(e) => set("price_grade", e.target.value)} className="text-base sm:text-sm">
          {PRICE_GRADES.map((g) => (
            <option key={g} value={g}>{g}등급 — 판매가 {g}</option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground">매출·견적에서 품목을 고르면 이 등급의 판매가가 들어가요.</span>
      </label>
      {FIELDS.map((f) => (
        <label key={f.key} className={`flex flex-col gap-1 text-sm ${f.wide ? "sm:col-span-2" : ""}`}>
          <span className="text-muted-foreground">{f.label}</span>
          <Input
            value={(form[f.key] as string | null) ?? ""}
            onChange={(e) => set(f.key, e.target.value)}
            className="text-base sm:text-sm"
          />
        </label>
      ))}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">기초 잔액(받을 돈 +, 줄 돈 −)</span>
        <Input
          inputMode="decimal"
          value={String(form.opening_balance ?? 0)}
          onChange={(e) => set("opening_balance", Number(e.target.value.replace(/,/g, "")) || 0)}
          className="text-right text-base tabular-nums sm:text-sm"
        />
      </label>
      <label className="flex items-center gap-2 self-end pb-2 text-sm">
        <input type="checkbox" className="size-4" checked={form.active} onChange={(e) => set("active", e.target.checked)} />
        사용 중(끄면 전표 입력 목록에서 숨겨요)
      </label>
      <div className="flex items-center gap-3 sm:col-span-2">
        <Button type="submit" disabled={saving}>{saving ? "저장 중…" : partner ? "정보 저장" : "거래처 추가"}</Button>
        {saved && <span className="text-sm text-emerald-700 dark:text-emerald-400">저장했어요.</span>}
        {error && <span className="text-sm text-destructive">{error}</span>}
      </div>
    </form>
  );
}
