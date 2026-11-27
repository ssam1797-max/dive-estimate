import Link from "next/link";
import { Pencil, Share2 } from "lucide-react";

/** 전표 줄 오른쪽 버튼: [열기] 수정 화면, [보내기] 출력·공유 화면 */
export function RowActions({ id }: { id: number }) {
  const btn =
    "inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent print:hidden";
  return (
    <span className="inline-flex gap-1">
      <Link href={`/erp/vouchers/${id}`} className={btn} title="전표 열기·수정">
        <Pencil className="size-3.5" /> 열기
      </Link>
      <Link href={`/erp/vouchers/${id}/print`} className={btn} title="출력·PDF·공유">
        <Share2 className="size-3.5" /> 보내기
      </Link>
    </span>
  );
}
