"use client";

import * as React from "react";
import { Loader2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { EquipmentCatalogItem } from "@/lib/estimates/types";

interface EquipmentQuickSearchProps {
  /**
   * 검색 결과를 클릭했을 때 호출된다. 이 컴포넌트는 견적 목록에 직접 담지
   * 않고(색상/사이즈/수량 선택은 여전히 기존 폼이 담당), 선택된 장비를
   * "브랜드→카테고리→장비" 3단계 폼에 그대로 채워 넣는 역할만 한다 — 그
   * 아래 색상/사이즈/수량/단가 계산·"견적 목록에 추가" 로직은 전부 기존
   * 코드를 그대로 탄다.
   */
  onSelect: (item: EquipmentCatalogItem) => void;
  disabled?: boolean;
}

const DEBOUNCE_MS = 250;

function formatVariant(item: EquipmentCatalogItem): string {
  const parts = [...item.colors, ...item.sizes];
  return parts.length > 0 ? parts.join(" / ") : "-";
}

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

  // 250ms 디바운스 — 입력마다 바로 DB 를 치지 않는다.
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
        const res = await fetch(
          `/api/equipment/search?q=${encodeURIComponent(debouncedQuery)}`,
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
          placeholder="브랜드·제품명·카테고리로 빠르게 검색 (예: 스쿠버프로 레귤레이터)"
          className="pl-9"
          aria-label="장비 통합 검색"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full min-w-[420px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          {error && <p className="px-3 py-3 text-sm text-destructive">{error}</p>}

          {!error && !loading && results.length === 0 && (
            <p className="px-3 py-3 text-sm text-muted-foreground">
              &quot;{debouncedQuery}&quot;와 일치하는 장비가 없습니다.
            </p>
          )}

          {!error && results.length > 0 && (
            <>
              <div className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2 border-b px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                <span>브랜드</span>
                <span>제품명</span>
                <span>규격</span>
                <span className="text-right">단가</span>
              </div>
              <ul className="max-h-72 overflow-y-auto p-1" role="listbox">
                {results.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={cn(
                        "grid w-full grid-cols-[1fr_1.4fr_1fr_auto] items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <span className="truncate text-muted-foreground">{item.brand}</span>
                      <span className="truncate font-medium">{item.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {formatVariant(item)}
                      </span>
                      <span className="whitespace-nowrap text-right text-xs">
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
