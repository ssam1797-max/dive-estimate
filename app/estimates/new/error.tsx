"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * app/layout.tsx 의 <GlobalNav /> 는 이 세그먼트의 부모이기 때문에, 여기서
 * 에러 바운더리가 열려도 상단 네비게이션은 언마운트되지 않고 계속 클릭 가능한
 * 상태로 남는다 — error.tsx 가 없을 때는 Next.js 기본 전역 에러 화면이 루트
 * 레이아웃까지 통째로 대체해 버려 상단 메뉴가 먹통이 됐었다.
 */
export default function EstimateNewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("견적서 작성 화면 렌더링 중 오류:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-6 sm:p-8">
      <h1 className="text-2xl font-semibold">견적서 작성</h1>
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
        <p className="font-medium">화면을 표시하는 중 오류가 발생했습니다.</p>
        <p className="mt-1 break-all">{error.message}</p>
      </div>
      <Button variant="outline" className="self-start" onClick={() => reset()}>
        다시 시도
      </Button>
    </main>
  );
}
