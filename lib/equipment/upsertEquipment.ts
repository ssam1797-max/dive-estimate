import "server-only";
import { upsertEquipmentBulk } from "@/lib/db/equipment-repo";
import type { ParsedEquipmentItem, EquipmentImportItemResult } from "@/lib/equipment/types";

interface UpsertEquipmentResult {
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  items: EquipmentImportItemResult[];
}

export async function upsertEquipment(
  brand: string,
  catalogYear: number,
  items: ParsedEquipmentItem[]
): Promise<UpsertEquipmentResult> {
  return upsertEquipmentBulk(brand, catalogYear, items);
}
