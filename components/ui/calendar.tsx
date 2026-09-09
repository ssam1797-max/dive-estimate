"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function parseDateString(value: string): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function buildCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

interface CalendarProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}

export function Calendar({ value, onChange, disabled }: CalendarProps) {
  const selected = parseDateString(value);
  const today = new Date();

  const [viewYear, setViewYear] = React.useState(
    selected?.getFullYear() ?? today.getFullYear()
  );
  const [viewMonth, setViewMonth] = React.useState(
    selected?.getMonth() ?? today.getMonth()
  );
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [isOpen]);

  const cells = buildCalendarDays(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handleSelect = (date: Date) => {
    onChange(toDateString(date));
    setIsOpen(false);
  };

  const displayValue = value
    ? value.replace(/-/g, ". ")
    : "날짜를 선택하세요";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors",
          "hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span>{displayValue}</span>
        <CalendarIcon className="size-4 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border bg-popover p-3 shadow-md">
          {/* 헤더 */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded p-1 hover:bg-accent"
              aria-label="이전 달"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-medium">
              {viewYear}년 {viewMonth + 1}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded p-1 hover:bg-accent"
              aria-label="다음 달"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DAY_LABELS.map((label) => (
              <span key={label} className="text-xs font-medium text-muted-foreground py-1">
                {label}
              </span>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7">
            {cells.map((date, idx) => {
              if (!date) return <span key={idx} />;
              const dateStr = toDateString(date);
              const isSelected = dateStr === value;
              const isToday = toDateString(date) === toDateString(today);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(date)}
                  className={cn(
                    "rounded-md py-1.5 text-sm transition-colors hover:bg-accent",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary",
                    isToday && !isSelected && "font-semibold text-primary"
                  )}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
