"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/pdf/exportElementToPdf";

export function PrintToolbar({
  backHref,
  fileName,
  suppliers = [],
  supplierId,
}: {
  backHref: string;
  fileName: string;
  suppliers?: { id: string; name: string }[];
  supplierId?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pickSupplier = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("supplier", id);
    router.replace(`${pathname}?${params}`);
  };
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const pdf = async () => {
    const el = document.querySelector<HTMLElement>(".erp-print-page");
    if (!el) return;
    setBusy(true);
    setError(null);
    try {
      await exportElementToPdf(el, `${fileName}.pdf`);
    } catch (e) {
      console.error(e);
      setError("PDF를 만드는 중 오류가 났어요.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 print:hidden">
      <Link href={backHref} className="inline-flex h-9 items-center gap-1 rounded-md border px-3 text-sm hover:bg-accent">
        <ArrowLeft className="size-4" /> 돌아가기
      </Link>
      <Button variant="outline" onClick={() => window.print()}>
        <Printer /> 인쇄
      </Button>
      <Button onClick={pdf} disabled={busy}>
        <Download /> {busy ? "만드는 중…" : "PDF 저장"}
      </Button>
      {suppliers.length > 1 && (
        <label className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">공급자</span>
          <select
            value={supplierId ?? ""}
            onChange={(e) => pickSupplier(e.target.value)}
            className="h-9 rounded-md border bg-background px-2 text-base sm:text-sm"
          >
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      )}
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
