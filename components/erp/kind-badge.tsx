import { VOUCHER_KIND_LABEL, type VoucherKind } from "@/lib/erp/types";

const KIND_STYLE: Record<VoucherKind, string> = {
  sale: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  purchase: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  receipt: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  payment: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  card_receipt: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  estimate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function KindBadge({ kind }: { kind: VoucherKind }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${KIND_STYLE[kind]}`}>{VOUCHER_KIND_LABEL[kind]}</span>;
}
