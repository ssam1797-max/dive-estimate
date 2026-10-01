"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { AdminModeButton } from "@/components/layout/admin-mode-button";
import { useAdminMode } from "@/components/layout/admin-mode-context";

const NAV_ITEMS = [
  { emoji: "📄", label: "견적서 작성", href: "/estimates/new", adminOnly: false },
  { emoji: "🗄️", label: "견적서 보관함", href: "/estimates", adminOnly: false },
  { emoji: "🏢", label: "공급자/고객 관리", href: "/profiles", adminOnly: false },
  { emoji: "📉", label: "브랜드 할인율 설정", href: "/discount-policies", adminOnly: true },
  { emoji: "📥", label: "장비 동기화/등록", href: "/equipment/import", adminOnly: true },
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

/**
 * 모든 페이지 상단에 고정되는 전역 내비게이션 바. md(768px) 이상에서는 메뉴를
 * 가로로 한 줄에 펼치고, 그 아래 좁은 화면(휴대전화)에서는 메뉴들이 서로
 * 겹치거나 글자가 잘리지 않도록 햄버거 버튼 + 드롭다운 목록으로 접는다.
 */
export function GlobalNav() {
  const pathname = usePathname();
  const activeHref = findActiveHref(pathname);
  const isAdmin = useAdminMode();
  const visibleNavItems = NAV_ITEMS.filter((item) => !item.adminOnly || isAdmin);
  const [menuOpen, setMenuOpen] = React.useState(false);

  // 페이지를 이동하면(링크를 눌렀거나 뒤/앞으로 가기) 열려 있던 모바일
  // 메뉴를 자동으로 닫는다 — 안 닫으면 새 화면 위에 이전 메뉴가 그대로 덮여 있다.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-2 px-4 py-2.5 sm:px-6">
        <Link
          href="/"
          className="mr-auto shrink-0 truncate text-sm font-semibold text-foreground hover:opacity-80"
        >
          다이빙 견적 시스템
        </Link>

        {/* md 이상: 메뉴를 한 줄에 가로로 펼친다 */}
        <nav aria-label="주요 기능" className="hidden items-center gap-1 md:flex">
          {visibleNavItems.map((item) => {
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
          <AdminModeButton />
        </nav>

        {/* md 미만(휴대전화): 햄버거 버튼 하나만 보이고, 메뉴는 눌렀을 때 아래로 펼쳐진다 */}
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "메뉴 닫기" : "메뉴 열기"}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
        >
          {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {menuOpen && (
        <nav
          aria-label="주요 기능(모바일)"
          className="flex flex-col gap-1 border-t px-4 py-3 md:hidden"
        >
          {visibleNavItems.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2.5 text-base font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <span className="mr-2">{item.emoji}</span>
                {item.label}
              </Link>
            );
          })}
          <div className="mt-1 border-t pt-3">
            <AdminModeButton />
          </div>
        </nav>
      )}
    </header>
  );
}
