import Link from "next/link";
import { PrintToolbar } from "@/components/erp/print-toolbar";
import { formatDate, todayKST } from "@/lib/erp/format";
import type { ProfileOption } from "@/lib/estimates/types";

/** 보고서 공통 틀: 조회 조건(화면 전용) + 출력·PDF·공유 + A4 종이 */
export function ReportShell({
  title,
  fileName,
  from,
  to,
  supplier,
  suppliers,
  filters,
  children,
}: {
  title: string;
  fileName: string;
  from?: string;
  to?: string;
  supplier: ProfileOption | null;
  suppliers: ProfileOption[];
  filters: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href="/erp/reports" className="text-sm text-muted-foreground hover:underline">보고서</Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-semibold">{title}</h1>
      </div>
      <form method="get" className="flex flex-wrap items-end gap-2 rounded-lg border p-3 text-sm print:hidden">
        {filters}
        <button className="h-9 rounded-md bg-primary px-4 font-medium text-primary-foreground">조회</button>
      </form>
      <PrintToolbar
        backHref="/erp/reports"
        fileName={fileName}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
        supplierId={supplier?.id}
      />
      <div className="erp-print-page mx-auto w-full max-w-[210mm] overflow-x-auto bg-white p-[10mm] text-neutral-900 shadow-sm print:overflow-visible print:p-0 print:shadow-none">
        <header className="mb-3 border-b-2 border-neutral-900 pb-2">
          <h2 className="text-center text-2xl font-bold tracking-[0.3em]">{title.split("").join(" ")}</h2>
          <div className="mt-1 flex flex-wrap justify-between gap-2 text-[12px]">
            <span>{supplier?.name ?? ""}</span>
            <span>
              {from && to ? `${formatDate(from)} ~ ${formatDate(to)}` : to ? `${formatDate(to)} 기준` : ""}
              {" · 출력 "}
              {formatDate(todayKST())}
            </span>
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function DateRange({ from, to }: { from: string; to: string }) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">시작일</span>
        <input type="date" name="from" defaultValue={from} className="h-9 rounded-md border px-2 text-base sm:text-sm" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-muted-foreground">종료일</span>
        <input type="date" name="to" defaultValue={to} className="h-9 rounded-md border px-2 text-base sm:text-sm" />
      </label>
    </>
  );
}

export function Choice({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: [string, string][];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-muted-foreground">{label}</span>
      <select name={name} defaultValue={value} className="h-9 rounded-md border bg-background px-2 text-base sm:text-sm">
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

/** 출력 표 공통 클래스 */
export const T = {
  table: "w-full border-collapse text-[12px]",
  head: "border-y border-neutral-900 bg-neutral-100",
  th: "px-1.5 py-1.5 text-left font-medium",
  thr: "px-1.5 py-1.5 text-right font-medium",
  tr: "border-b border-neutral-200",
  td: "px-1.5 py-1",
  num: "whitespace-nowrap px-1.5 py-1 text-right tabular-nums",
  foot: "border-t-2 border-neutral-900 bg-neutral-100 font-semibold",
};

/** 기본 기간: 올해 1월 1일 ~ 오늘 */
export function defaultRange(sp: { from?: string; to?: string }) {
  const today = todayKST();
  return { from: sp.from || `${today.slice(0, 4)}-01-01`, to: sp.to || today };
}
