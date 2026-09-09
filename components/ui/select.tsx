import * as React from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * 가벼운 네이티브 <select> 래퍼.
 * (Radix 기반 shadcn Select 를 쓰지 않고 최소 의존성으로 구현한 버전입니다.
 *  추후 네트워크 제약 없이 `npx shadcn add select` 를 실행하면 더 풍부한
 *  팝오버 스타일 Select 로 교체할 수 있습니다.)
 */
const Select = React.forwardRef<
  HTMLSelectElement,
  React.ComponentProps<"select">
>(({ className, children, ...props }, ref) => {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "flex h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
});
Select.displayName = "Select";

export { Select };
