"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/pdf/exportElementToPdf";

export function PrintToolbar({ backHref, fileName }: { backHref: string; fileName: string }) {
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
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
