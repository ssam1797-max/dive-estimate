"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

/** 어떤 이유로든 경로 변경 이벤트를 놓쳤을 때 막대가 영원히 떠 있지 않도록 하는 안전장치. */
const AUTO_CLEAR_MS = 10000;
/** "로딩 중" 동안 끝까지 채우지 않고 멈춰서 기다리는 목표 지점(%). */
const LOADING_TARGET_PERCENT = 88;
/** 그 지점까지 서서히 차오르는 데 걸리는 시간(ms) — 실제 이동 시간과 무관하게 항상 이 속도로 움직인다. */
const LOADING_DURATION_MS = 4000;
/** 이동이 끝난 뒤 100%로 마저 채우는 데 걸리는 시간(ms). */
const FINISH_DURATION_MS = 200;
/** 100% 로 다 채운 뒤, 사라지기 전까지 보여주는 시간(ms). */
const HOLD_BEFORE_FADE_MS = 150;

type BarState = "idle" | "loading" | "done";

/**
 * 메뉴/링크 클릭으로 페이지를 이동할 때 화면 맨 위에 얇은 진행바를 보여준다.
 *
 * app/loading.tsx(Suspense fallback)만으로는 부족하다 — Next.js App
 * Router의 <Link> 이동은 React 트랜지션으로 처리되는데, 트랜지션 중에는
 * 전환 대상이 아직 로딩 중이어도 "이미 화면에 떠 있던 콘텐츠"를 그대로
 * 유지하고 fallback 을 보여주지 않는 것이 React의 의도된 동작이다(화면이
 * 불필요하게 깜빡이는 것을 막기 위함). 그 결과 새로고침/직접 URL 접속
 * 때는 loading.tsx 가 보이지만, 메뉴 클릭으로 이동할 때는 전혀 뜨지 않는다.
 *
 * 그래서 Suspense 와 별개로, 내부 링크 클릭을 캡처 단계에서 직접 감지해
 * 이동이 끝날 때까지(pathname 이 바뀔 때까지) 맨 위에 진행바를 채운다.
 * (버블 단계에서 감지하면 Next.js Link 가 이미 preventDefault() 를 호출한
 * 뒤라 event.defaultPrevented 가 항상 true 라 아예 걸리지 않는다 — 반드시
 * "캡처" 단계에서 먼저 가로채야 한다.)
 */
export function NavigationLoadingOverlay() {
  const pathname = usePathname();
  const [state, setState] = React.useState<BarState>("idle");
  const autoClearRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (autoClearRef.current) clearTimeout(autoClearRef.current);
    if (fadeRef.current) clearTimeout(fadeRef.current);
  };

  // 경로가 바뀌었다는 건 이동이 끝나 새 페이지가 커밋됐다는 뜻이다 —
  // 진행 중이었다면 100%로 마저 채운 뒤 잠깐 보여주고 사라진다.
  React.useEffect(() => {
    setState((prev) => {
      if (prev !== "loading") return prev;
      if (autoClearRef.current) clearTimeout(autoClearRef.current);
      return "done";
    });
  }, [pathname]);

  React.useEffect(() => {
    if (state !== "done") return;
    fadeRef.current = setTimeout(() => setState("idle"), FINISH_DURATION_MS + HOLD_BEFORE_FADE_MS);
    return () => {
      if (fadeRef.current) clearTimeout(fadeRef.current);
    };
  }, [state]);

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
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

      clearTimers();
      setState("loading");
      autoClearRef.current = setTimeout(() => setState("idle"), AUTO_CLEAR_MS);
    };

    // 캡처 단계(3번째 인자 true)에서 먼저 가로챈다 — 버블 단계까지 기다리면
    // Next.js Link 가 이미 preventDefault() 를 호출해버린 뒤라
    // event.defaultPrevented 가 항상 true 라서 위 체크에 막혀 절대 못 들어온다.
    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimers();
    };
  }, []);

  const isVisible = state !== "idle";
  const widthPercent = state === "loading" ? LOADING_TARGET_PERCENT : state === "done" ? 100 : 0;

  // idle 로 돌아갈 때는 이미 opacity 가 0(안 보임)이 된 뒤이므로, 폭을 0%로
  // 되돌리는 건 transition 없이 즉시 해도 눈에 보이지 않는다. done 에서는
  // 먼저 폭을 100%까지 빠르게 채운 뒤(opacity 는 그 동안 그대로 1 유지),
  // 폭 전환이 끝나는 시점에 맞춰(transition-delay) 그제야 페이드아웃을
  // 시작한다 — 그래야 "다 채워진 막대가 사라지는" 것처럼 보인다.
  const transition =
    state === "loading"
      ? `width ${LOADING_DURATION_MS}ms cubic-bezier(0.1, 0.8, 0.2, 1)`
      : state === "done"
        ? `width ${FINISH_DURATION_MS}ms ease-out, opacity ${HOLD_BEFORE_FADE_MS}ms ease-out ${FINISH_DURATION_MS}ms`
        : "none";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={isVisible ? "페이지 이동 중" : undefined}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] print:hidden"
    >
      <div
        className="h-full bg-primary shadow-[0_0_8px_var(--color-primary)]"
        style={{
          width: `${widthPercent}%`,
          opacity: state === "idle" ? 0 : 1,
          transition,
        }}
      />
    </div>
  );
}
