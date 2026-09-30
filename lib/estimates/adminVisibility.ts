import { resolveViewableTier } from "@/lib/estimates/pricing";
import type { SavedEstimateDetail, SavedEstimateSummary } from "@/lib/estimates/types";

/**
 * 관리자가 아니면 견적서 요약(목록/보관함)의 원가("COST") 등급 합계를
 * 응답/화면 데이터에서 제거한다. 등급 선택 UI 에서도 "원가"가 빠져있어
 * 실제로 쓰이지는 않지만, API 응답/서버 컴포넌트 데이터 자체에 숫자가
 * 실려나가지 않도록 방어적으로 한 번 더 막는다.
 */
export function stripCostFromSummary<T extends SavedEstimateSummary>(
  summary: T,
  isAdmin: boolean
): T {
  if (isAdmin) return summary;
  return {
    ...summary,
    totalsByTier: { ...summary.totalsByTier, COST: summary.totalsByTier.RETAIL },
  };
}

/**
 * 관리자가 아니면 견적서 상세의 품목별 원가 스냅샷(priceCost)과 저장
 * 당시 등급(priceTier)을 함께 정리한다 — 저장 당시 등급이 "COST"였다면
 * "RETAIL"로 바꿔, 상세/인쇄 화면이 처음부터 원가 기준으로 열리지 않게 한다.
 */
export function stripCostForViewer(
  detail: SavedEstimateDetail,
  isAdmin: boolean
): SavedEstimateDetail {
  if (isAdmin) return detail;
  return {
    ...stripCostFromSummary(detail, isAdmin),
    priceTier: resolveViewableTier(detail.priceTier, isAdmin),
    items: detail.items.map((item) => ({ ...item, priceCost: null })),
  };
}
