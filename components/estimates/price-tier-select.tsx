"use client";

import { cn } from "@/lib/utils";
import { PRICE_TIERS, PRICE_TIER_LABELS, type PriceTier } from "@/lib/estimates/pricing";

interface PriceTierTabsProps {
  value: PriceTier;
  onChange: (tier: PriceTier) => void;
  disabled?: boolean;
}

export function PriceTierSelect({ value, onChange, disabled }: PriceTierTabsProps) {
  return (
    <div className="flex rounded-lg border p-0.5 gap-0.5 bg-muted">
      {PRICE_TIERS.map((tier) => (
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
