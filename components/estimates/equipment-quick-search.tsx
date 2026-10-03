"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import type { EquipmentCatalogItem } from "@/lib/estimates/types";

interface EquipmentQuickSearchProps {
  /**
   * 검색 결과를 클릭했을 때 호출된다. 이 컴포넌트는 색상/사이즈/수량 선택이나
   * 장바구니 담기를 직접 하지 않고, 선택된 장비 하나를 그대로 넘겨주기만
   * 한다 — 호출부(EquipmentPicker)가 이미지 큰 담기 확인 모달을 띄운다.
   */
  onSelect: (item: EquipmentCatalogItem) => void;
  disabled?: boolean;
}

const DEBOUNCE_MS = 180;

/**
 * 품목 추가 영역 상단에 독립적으로 얹는 "키워드 통합 검색" — 브랜드/카테고리
 * 구분 없이 검색어 하나로 장비를 바로 찾는 자동완성 드롭다운. 자체 로컬
 * state(query/results/loading)만 쓰고, 기존 EquipmentPicker 의 폼 state
 * (brand/category/equipmentId 등)에는 onSelect 콜백을 통해서만 연결된다 —
 * 이 컴포넌트 자체는 그 state 를 전혀 알지 못한다.
 */
export function EquipmentQuickSearch({ onSelect, disabled }: EquipmentQuickSearchProps) {
  const [query, setQuery] = React.useState("");
  const [debouncedQuery, setDebouncedQuery] = React.useState("");
  const [results, setResults] = React.useState<EquipmentCatalogItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // 180ms 디바운스 — 입력마다 바로 DB 를 치지 않는다.
  // 한글 IME 조합 중(compositionstart~compositionend 사이)에도 브라우저는
  // 매 키 입력마다 onChange(input 이벤트)를 발생시켜 e.target.value 를 그
  // 즉시 최신 조합 상태로 갱신해준다 — 따라서 이 타이머는 조합 여부를
  // 구분할 필요가 없다. 예전에는 조합 중에는 타이머를 걸지 않도록 막아
  // 뒀는데, 한글 IME 구현에 따라 compositionend 가 스페이스바(단어 경계)
  // 를 눌러야만 발생하는 경우가 있어("가민" 입력 완료 → 스페이스 → 그제야
  // compositionend) 결과적으로 스페이스바를 눌러야만 검색이 실행되는
  // 것처럼 보이는 버그의 원인이었다.
  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    // 검색어가 비면 아무 것도 하지 않는다 — state 를 여기서 동기적으로
    // 지우지 않아도 되는 이유: 드롭다운 자체가 showDropdown(=
    // debouncedQuery 가 있을 때만 true) 조건으로 안 그려지고, 이전에 진행
    // 중이던 요청이 있었다면 아래 cleanup(controller.abort())이 그 요청의
    // finally 에서 loading 을 false 로 되돌려준다.
    if (!debouncedQuery) return;

    const controller = new AbortController();

    // setLoading/setError 를 effect 본문에서 곧바로 부르지 않고 이 async
    // 함수 안에서 제일 먼저 호출한다 — react-hooks/set-state-in-effect
    // 규칙이 effect 본문에서의 "동기적" setState 만 문제 삼기 때문에
    // (estimate-archive-table.tsx 의 기존 상세 조회 effect 도 같은 이유로
    // 비동기 함수 내부에서 상태를 갱신한다), 그 관례를 그대로 따른다.
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // limit=0 은 "상위 20건 제한 없이 매칭되는 전체 결과" 요청이다
        // (searchEquipment 의 unlimited 분기, fetchAllPages 로 상한 없이
        // 가져온다) — 드롭다운 <ul> 은 max-h-72 overflow-y-auto 라 결과가
        // 많아도 스크롤로 전부 확인할 수 있다.
        const res = await fetch(
          `/api/equipment/search?q=${encodeURIComponent(debouncedQuery)}&limit=0`,
          { signal: controller.signal }
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "검색에 실패했습니다.");
        setResults(body.items as EquipmentCatalogItem[]);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "검색에 실패했습니다.");
        setResults([]);
      } finally {
        setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [debouncedQuery]);

  React.useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (item: EquipmentCatalogItem) => {
    onSelect(item);
    setQuery("");
    setDebouncedQuery("");
    setResults([]);
    setOpen(false);
  };

  const showDropdown = open && debouncedQuery.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onCompositionEnd={(e) => {
            // 조합이 끝난 최종 완성 글자로 한 번 더 동기화 — onChange 가
            // 조합 중간에도 계속 불렸으므로 보통은 이미 같은 값이지만,
            // 브라우저별로 compositionend 시점에 value 가 살짝 다르게
            // 처리되는 경우를 방어한다.
            setQuery(e.currentTarget.value);
          }}
          placeholder="브랜드·제품명·카테고리로 빠르게 검색 (예: 스쿠버프로 레귤레이터)"
          className="pl-9"
          aria-label="장비 통합 검색"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full max-w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md sm:min-w-[420px]">
          {error && <p className="px-3 py-3 text-sm text-destructive">{error}</p>}

          {!error && !loading && results.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              &quot;{debouncedQuery}&quot;와 일치하는 장비가 없습니다.
            </p>
          )}

          {!error && results.length > 0 && (
            <>
              {/*
                브랜드/제품명/소비자가 3열 — 썸네일은 일부러 넣지 않는다(여기는
                빠르게 훑어보는 목록용이고, 이미지로 크게 확인하는 건 클릭 후
                뜨는 담기 확인 모달의 역할). 브랜드 칸을 auto 가 아니라
                고정폭(4.5rem)으로 둬야, 행마다 따로인 grid 컨테이너들 사이에서도
                제품명이 시작되는 위치가 전부 같아져 표처럼 줄이 맞는다.
              */}
              <div className="grid grid-cols-[4.5rem_1fr_auto] gap-3 border-b px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span>브랜드</span>
                <span>제품명</span>
                <span>소비자가</span>
              </div>
              <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className="grid w-full grid-cols-[4.5rem_1fr_auto] items-start gap-3 rounded-sm px-3 py-3 text-left hover:bg-accent hover:text-accent-foreground"
                    >
                      <span className="break-words pt-0.5 text-xs text-muted-foreground">
                        {item.brand}
                      </span>
                      {/* min-w-0 이 없으면 grid 아이템이 내용 너비만큼 늘어나 줄바꿈 대신 넘쳐버린다. */}
                      <span className="min-w-0 break-words text-sm font-medium leading-snug">
                        {item.name}
                      </span>
                      <span className="whitespace-nowrap pt-0.5 text-xs text-muted-foreground">
                        ₩{item.price_retail.toLocaleString("ko-KR")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
