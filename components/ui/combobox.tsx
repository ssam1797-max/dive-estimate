"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { matchesKoreanSearch } from "@/lib/hangul";

export interface ComboboxOption {
  value: string;
  label: string;
  description?: string;
}

interface ComboboxProps {
  id?: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  /**
   * true면 목록에 없는 값을 검색창에 그대로 입력해 새로 등록할 수 있다
   * (예: 브랜드 할인율 설정 화면에서 새 브랜드 추가). 기본값 false — 기존
   * Combobox 호출부(장비 브랜드/카테고리/장비명 선택 등)는 전혀 영향 없다.
   */
  allowCustomValue?: boolean;
}

/**
 * 검색 가능한 드롭다운(Combobox).
 * (Radix Popover/Command 를 쓰지 않고 최소 의존성으로 구현한 버전입니다.)
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder = "선택하세요",
  searchPlaceholder = "검색...",
  emptyMessage = "일치하는 항목이 없습니다.",
  disabled,
  className,
  allowCustomValue = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const selectedOption = options.find((option) => option.value === value);
  // allowCustomValue 로 등록된 값은 options 목록에 없을 수 있으니, 그 경우
  // value 자체를 라벨처럼 그대로 보여준다(placeholder 로 잘못 표시되지 않도록).
  const displayLabel = selectedOption?.label ?? (allowCustomValue && value ? value : undefined);

  const filteredOptions = React.useMemo(() => {
    if (!query.trim()) return options;
    return options.filter(
      (option) =>
        matchesKoreanSearch(option.label, query) ||
        (option.description ? matchesKoreanSearch(option.description, query) : false)
    );
  }, [options, query]);

  const trimmedQuery = query.trim();
  // 검색어가 기존 옵션 중 어느 것과도 정확히 같지 않을 때만 "새로 추가" 를 보여준다
  // (대소문자 무시 비교 — "Scubapro" 를 입력했는데 이미 "scubapro" 값이 있으면 중복 추가를 막는다).
  const showCreateOption =
    allowCustomValue &&
    trimmedQuery.length > 0 &&
    !options.some((option) => option.value.toLowerCase() === trimmedQuery.toLowerCase());

  // 드롭다운을 닫을 때는 항상 이 함수를 통해서 닫아, 검색어도 함께 초기화합니다.
  // (useEffect 안에서 open 변화에 반응해 setQuery 를 호출하는 대신, 닫는 동작이
  // 일어나는 이벤트 핸들러 시점에 바로 초기화합니다.)
  const closeDropdown = React.useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);

  React.useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        closeDropdown();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDropdown();
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    // 열리자마자 검색창에 포커스
    requestAnimationFrame(() => searchInputRef.current?.focus());

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closeDropdown]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => (open ? closeDropdown() : setOpen(true))}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          !displayLabel && "text-muted-foreground"
        )}
      >
        <span className="truncate">
          {displayLabel ?? placeholder}
        </span>
        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full min-w-56 rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
            {filteredOptions.length === 0 && !showCreateOption && (
              <li className="px-2 py-3 text-center text-sm text-muted-foreground">
                {emptyMessage}
              </li>
            )}
            {showCreateOption && (
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onChange(trimmedQuery);
                    closeDropdown();
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
                >
                  <Plus className="size-4 shrink-0" />
                  <span className="truncate">&quot;{trimmedQuery}&quot; 새로 추가</span>
                </button>
              </li>
            )}
            {filteredOptions.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    closeDropdown();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                    option.value === value && "bg-accent/60"
                  )}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{option.label}</span>
                    {option.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
