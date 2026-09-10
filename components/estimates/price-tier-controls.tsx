"use client";

import { Select } from "@/components/ui/select";
import { PRICE_TIERS, PRICE_TIER_LABELS, type PriceTier } from "@/lib/estimates/pricing";

/**
 * "기준 등급" — 실제 결제 금액(단가/공급가액/부가세/총합계금액)을 계산하는
 * 데 쓰이는 등급 단 하나. 예전 탭(PriceTierSelect)이 하던 역할과 동일하지만,
 * 이제 "표시할 참고 등급"은 아래 ReferenceTierCheckboxes 로 완전히 분리됐다.
 */
export function BasisTierSelect({
  value,
  onChange,
  disabled,
}: {
  value: PriceTier;
  onChange: (tier: PriceTier) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="basis-tier-select" className="whitespace-nowrap text-sm font-medium">
        기준 등급
      </label>
      <Select
        id="basis-tier-select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as PriceTier)}
        className="w-28"
      >
        {PRICE_TIERS.map((tier) => (
          <option key={tier} value={tier}>
            {PRICE_TIER_LABELS[tier]}
          </option>
        ))}
      </Select>
      <span className="text-xs text-muted-foreground">
        (단가·총 합계금액 계산 기준)
      </span>
    </div>
  );
}

/**
 * 문서에 참고용으로 함께 노출할 가격 등급들(0~4개, 다중 선택). 체크된
 * 등급들은 "하나의 견적서 테이블"에 추가 열로 동시에 표시되지만, 실제
 * 결제 금액(총 합계금액) 계산에는 전혀 영향을 주지 않는다.
 */
export function ReferenceTierCheckboxes({
  value,
  onChange,
  disabled,
}: {
  value: PriceTier[];
  onChange: (tiers: PriceTier[]) => void;
  disabled?: boolean;
}) {
  const toggle = (tier: PriceTier) => {
    onChange(
      value.includes(tier) ? value.filter((t) => t !== tier) : [...value, tier]
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="whitespace-nowrap text-sm font-medium">참고 가격 표시</span>
      {PRICE_TIERS.map((tier) => (
        <label key={tier} className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={value.includes(tier)}
            disabled={disabled}
            onChange={() => toggle(tier)}
            className="size-4 rounded border-input accent-primary"
          />
          {PRICE_TIER_LABELS[tier]}
        </label>
      ))}
    </div>
  );
}
