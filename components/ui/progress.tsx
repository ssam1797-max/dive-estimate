import * as React from "react";

import { cn } from "@/lib/utils";

export interface ProgressProps extends React.ComponentProps<"div"> {
  /** 0 ~ 100 사이의 진행률. */
  value?: number;
}

/**
 * 가벼운 순수 CSS 기반 진행률 표시줄.
 * (Radix Progress 를 쓰지 않고 직접 구현한 최소 버전입니다.)
 */
const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value));

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
          className
        )}
        {...props}
      >
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    );
  }
);
Progress.displayName = "Progress";

export { Progress };
