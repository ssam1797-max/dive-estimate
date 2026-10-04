"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const TABS = [
  { label: "데이터 동기화", href: "/equipment/import" },
  { label: "직접 등록", href: "/equipment/new" },
  { label: "장비 목록(수정/삭제)", href: "/equipment/list" },
  { label: "확인 필요 품목", href: "/equipment/review" },
];

interface EquipmentNavProps {
  /** "확인 필요 품목" 탭 옆에 빨간 뱃지로 띄울 대기 건수. 0이면 뱃지를 숨긴다. */
  pendingReviewCount?: number;
}

export function EquipmentNav({ pendingReviewCount = 0 }: EquipmentNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex overflow-x-auto border-b" aria-label="장비 등록 방식">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        const showBadge = tab.href === "/equipment/review" && pendingReviewCount > 0;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
            {showBadge && (
              <Badge variant="destructive" className="rounded-full px-1.5 py-0 text-[11px]">
                {pendingReviewCount}
              </Badge>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
