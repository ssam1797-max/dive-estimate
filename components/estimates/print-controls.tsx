"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Pencil, Printer } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { exportElementToPdf } from "@/lib/pdf/exportElementToPdf";

interface PrintControlsProps {
  /** 전달하면 "이어서 수정" 버튼이 함께 표시된다(견적서 보관함 상세/인쇄 화면 전용). */
  estimateId?: string;
  /** PDF로 저장할 때 쓸 파일명(확장자 제외). */
  fileName?: string;
}

/** 보관함 견적서 인쇄 화면 상단 버튼줄. 인쇄 시(@media print)에는 통째로 숨긴다. */
export function PrintControls({ estimateId, fileName }: PrintControlsProps) {
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleDownloadPdf = async () => {
    const element = document.querySelector<HTMLElement>(".estimate-a4-page");
    if (!element) return;

    setIsDownloading(true);
    setError(null);
    try {
      await exportElementToPdf(element, `${fileName ?? "견적서"}.pdf`);
    } catch (downloadError) {
      console.error("PDF 다운로드 실패:", downloadError);
      setError("PDF를 만드는 중 오류가 발생했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 pt-4 print:hidden">
      <div className="flex items-center justify-between gap-2">
        <Link href="/estimates" className={buttonVariants({ variant: "outline" })}>
          <ArrowLeft className="size-4" />
          보관함으로
        </Link>
        <div className="flex items-center gap-2">
          {estimateId && (
            <Link
              href={`/estimates/${estimateId}/edit`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="size-4" />
              이어서 수정
            </Link>
          )}
          <Button
            type="button"
            variant="outline"
            disabled={isDownloading}
            onClick={handleDownloadPdf}
          >
            {isDownloading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            PDF 다운로드
          </Button>
          <Button type="button" onClick={() => window.print()}>
            <Printer className="size-4" />
            인쇄하기
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
