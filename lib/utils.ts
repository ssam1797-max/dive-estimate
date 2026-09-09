import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind 클래스 병합 유틸리티 (shadcn/ui 컴포넌트에서 공통으로 사용).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
