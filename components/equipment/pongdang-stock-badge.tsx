"use client";

import { useAdminMode } from "@/components/layout/admin-mode-context";
import {
  getPongdangStockStatus,
  hasPongdangStockInfo,
} from "@/lib/equipment/stockNote";
import { cn } from "@/lib/utils";

interface PongdangStockBadgeProps {
  item: { name: string; is_sold_out?: boolean | null };
  className?: string;
}

/**
 * 견적서 작성 화면에서만 보이는 퐁당닷컴 재고 표시. 관리자 모드일 때만
 * 그린다 — 공급처 이름과 재고 사정은 고객에게 보여줄 정보가 아니다.
 * 견적서/거래명세서/엑셀 같은 출력물에는 이 배지가 들어가지 않는다.
 */
export function PongdangStockBadge({ item, className }: PongdangStockBadgeProps) {
  const isAdmin = useAdminMode();
  if (!isAdmin) return null;

  const status = getPongdangStockStatus(item);
  if (!hasPongdangStockInfo(status)) return null;

  const title = status.soldOut
    ? status.note
      ? `퐁당닷컴 목록에서 내려가 품절로 처리된 품목입니다. 품절 당시 표기: ${status.note}`
      : "퐁당닷컴 목록에서 내려가 품절로 처리된 품목입니다."
    : `퐁당닷컴 표기: ${status.note}`;

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)} title={title}>
      {status.soldOut && (
        <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
          퐁당 품절
        </span>
      )}
      {status.note && (
        <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
          {status.note}
        </span>
      )}
    </span>
  );
}
