"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

/** 어떤 이유로든 경로 변경 이벤트를 놓쳤을 때 오버레이가 영원히 떠 있지 않도록 하는 안전장치. */
const AUTO_CLEAR_MS = 10000;

/**
 * 메뉴/링크 클릭으로 페이지를 이동할 때 화면 중앙에 "페이지를 이동
 * 중입니다..." 오버레이를 띄운다.
 *
 * app/loading.tsx(Suspense fallback)만으로는 부족하다 — Next.js App
 * Router의 <Link> 이동은 React 트랜지션으로 처리되는데, 트랜지션 중에는
 * 전환 대상이 아직 로딩 중이어도 "이미 화면에 떠 있던 콘텐츠"를 그대로
 * 유지하고 fallback 을 보여주지 않는 것이 React의 의도된 동작이다(화면이
 * 불필요하게 깜빡이는 것을 막기 위함). 그 결과 새로고침/직접 URL 접속
 * 때는 loading.tsx 가 보이지만, 메뉴 클릭으로 이동할 때는 전혀 뜨지 않는다.
 *
 * 그래서 Suspense 와 별개로, 내부 링크 클릭을 document 레벨에서 직접
 * 감지해 이동이 끝날 때까지(pathname 이 바뀔 때까지) 오버레이를 띄운다.
 */
export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 경로가 바뀌었다는 건 이동이 끝나 새 페이지가 커밋됐다는 뜻이다.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsNavigating(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, [pathname]);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // 왼쪽 클릭이 아니거나(가운데/오른쪽 버튼), 수정키(새 탭 열기 등)가
      // 눌려 있거나, 이미 다른 핸들러가 처리한 클릭은 건드리지 않는다.
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as HTMLElement | null)?.closest("a");
      if (!anchor) return;
      if (anchor.target && anchor.target !== "_self") return; // 새 탭(_blank) 등은 제외
      if (anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      // 외부 사이트 링크는 이 앱 안에서 "페이지 이동"이 아니므로 제외한다.
      if (url.origin !== window.location.origin) return;
      // 같은 경로(쿼리까지 동일)를 다시 누른 것이면 실제 이동이 아니다.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      setIsNavigating(true);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => setIsNavigating(false), AUTO_CLEAR_MS);
    };

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!isNavigating) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm print:hidden"
    >
      <Loader2 className="size-8 animate-spin text-primary" />
      <p className="text-sm font-medium text-muted-foreground">페이지를 이동 중입니다...</p>
    </div>
  );
}
