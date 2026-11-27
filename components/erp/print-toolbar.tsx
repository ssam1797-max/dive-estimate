"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Download, Printer, Share2 } from "lucide-react";
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
  const [note, setNote] = React.useState<string | null>(null);

  /** PDF 를 만들어 휴대폰·Mac 공유창(카카오톡, 메일, 메시지 등)으로 보낸다. 안 되면 PDF 로 저장. */
  const share = async () => {
    const el = document.querySelector<HTMLElement>(".erp-print-page");
    if (!el) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const blob = await exportElementToPdf(el, `${fileName}.pdf`, { output: "blob" });
      if (!blob) throw new Error("PDF 생성 실패");
      const file = new File([blob], `${fileName}.pdf`, { type: "application/pdf" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: fileName });
      } else {
        await exportElementToPdf(el, `${fileName}.pdf`);
        setNote("이 브라우저는 바로 공유를 지원하지 않아 PDF로 저장했어요. 저장된 파일을 카카오톡·메일에 첨부해 보내세요.");
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 공유창을 닫은 경우
      console.error(e);
      setError("공유용 PDF를 만드는 중 오류가 났어요.");
    } finally {
      setBusy(false);
    }
  };

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
      <Button variant="secondary" onClick={share} disabled={busy}>
        <Share2 /> 공유
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
      {note && <span className="basis-full text-sm text-muted-foreground">{note}</span>}
    </div>
  );
}
