import "server-only";
import { saveEstimate as saveEstimateToRepo } from "@/lib/db/estimate-repo";
import type { SaveEstimateItemPayload } from "@/lib/estimates/types";
import type { PriceTier } from "@/lib/estimates/pricing";

interface SaveEstimateParams {
  estimateNumber: string | null;
  date: string | null;
  providerId: string | null;
  receiverId: string | null;
  remarks: string | null;
  templateName: string | null;
  /** 저장 시점 선택되어 있던 가격 등급. 템플릿 저장 시에는 null. */
  priceTier: PriceTier | null;
  items: SaveEstimateItemPayload[];
}

export async function saveEstimate(params: SaveEstimateParams): Promise<string> {
  return saveEstimateToRepo(params);
}
