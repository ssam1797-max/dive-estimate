import type { OptionSoldOut } from "@/lib/equipment/optionStock";
import { isColorSoldOut, isSizeSoldOut } from "@/lib/equipment/optionStock";

interface SoldOutOptionHintProps {
  soldOut: OptionSoldOut | undefined;
  color: string;
  size: string;
}

/**
 * 고른 색상/사이즈가 퐁당닷컴에서 품절이면 담기 전에 알려준다. 선택을
 * 막지는 않는다(품절 옵션도 견적은 낼 수 있고, 입고는 따로 확인한다).
 */
export function SoldOutOptionHint({ soldOut, color, size }: SoldOutOptionHintProps) {
  const colorSoldOut = color !== "" && isColorSoldOut(soldOut, color);
  const sizeSoldOut = size !== "" && isSizeSoldOut(soldOut, size, color || undefined);
  if (!colorSoldOut && !sizeSoldOut) return null;

  const target = colorSoldOut && size === "" ? `"${color}" 색상` : "선택한 옵션";
  return (
    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
      {target}은 퐁당닷컴에서 품절이에요. 견적에는 담을 수 있지만 주문 전에 입고 일정을 확인하세요.
    </p>
  );
}
