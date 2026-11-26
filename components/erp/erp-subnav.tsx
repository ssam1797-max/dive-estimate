"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/erp", label: "현황" },
  { href: "/erp/vouchers", label: "전표" },
  { href: "/erp/partners", label: "거래처" },
  { href: "/erp/items", label: "품목·재고" },
];

export function ErpSubnav() {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/erp" ? pathname === "/erp" : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <div className="flex flex-wrap items-center gap-2 py-4 print:hidden">
      <nav aria-label="장부 메뉴" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active(t.href) ? "page" : undefined}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active(t.href)
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex gap-2">
        <Link
          href="/erp/vouchers/new"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          + 전표 입력
        </Link>
        <a
          href="/api/erp/export"
          className="inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium hover:bg-accent"
        >
          엑셀 백업
        </a>
      </div>
    </div>
  );
}
