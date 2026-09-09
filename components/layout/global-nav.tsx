"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { emoji: "📄", label: "견적서 작성", href: "/estimates/new" },
  { emoji: "🗄️", label: "견적서 보관함", href: "/estimates" },
  { emoji: "🏢", label: "공급자/고객 관리", href: "/profiles" },
  { emoji: "📉", label: "브랜드 할인율 설정", href: "/discount-policies" },
  { emoji: "📥", label: "장비 동기화/등록", href: "/equipment/import" },
] as const;

/**
 * 여러 메뉴의 href 가 서로의 접두사가 되는 경우(예: "/estimates" 와
 * "/estimates/new")를 대비해, 일치하는 항목 중 가장 구체적인(=href 가 가장 긴)
 * 항목 하나만 활성 상태로 고른다. (그렇지 않으면 "/estimates/new" 방문 시
 * "견적서 작성"과 "견적서 보관함"이 동시에 활성화되어 보인다.)
 */
function findActiveHref(pathname: string): string | null {
  let best: string | null = null;
  for (const item of NAV_ITEMS) {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && (best === null || item.href.length > best.length)) {
      best = item.href;
    }
  }
  return best;
}

/** 모든 페이지 상단에 고정되는 전역 내비게이션 바. */
export function GlobalNav() {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
      <nav
        aria-label="주요 기능"
        className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2 sm:gap-2 sm:px-6"
      >
        <Link
          href="/"
          className="mr-2 shrink-0 text-sm font-semibold text-foreground hover:opacity-80"
        >
          다이빙 견적 시스템
        </Link>

        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <span className="mr-1.5">{item.emoji}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
