"use client";

import Link from "next/link";
import { ArrowLeft, Pencil, Printer } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

interface PrintControlsProps {
  /** 전달하면 "이어서 수정" 버튼이 함께 표시된다(견적서 보관함 상세/인쇄 화면 전용). */
  estimateId?: string;
}

/** 보관함 견적서 인쇄 화면 상단 버튼줄. 인쇄 시(@media print)에는 통째로 숨긴다. */
export function PrintControls({ estimateId }: PrintControlsProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 pt-4 print:hidden">
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
        <Button type="button" onClick={() => window.print()}>
          <Printer className="size-4" />
          인쇄하기
        </Button>
      </div>
    </div>
  );
}
