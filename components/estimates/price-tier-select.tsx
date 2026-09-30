"use client";

import { cn } from "@/lib/utils";
import { PRICE_TIERS, PRICE_TIER_LABELS, type PriceTier } from "@/lib/estimates/pricing";

interface PriceTierTabsProps {
  value: PriceTier;
  onChange: (tier: PriceTier) => void;
  disabled?: boolean;
  /** 선택 가능한 등급 목록. 기본은 전체 등급 — 관리자 모드가 아니면 getAllowedPriceTiers(false) 를 넘겨 "원가"를 제외한다. */
  tiers?: PriceTier[];
}

export function PriceTierSelect({
  value,
  onChange,
  disabled,
  tiers = PRICE_TIERS,
}: PriceTierTabsProps) {
  return (
    <div className="flex rounded-lg border p-0.5 gap-0.5 bg-muted">
      {tiers.map((tier) => (
        <button
          key={tier}
          type="button"
          disabled={disabled}
          onClick={() => onChange(tier)}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap",
            value === tier
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {PRICE_TIER_LABELS[tier]}
        </button>
      ))}
    </div>
  );
}
