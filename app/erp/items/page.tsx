import { loadErpData } from "@/lib/erp/repo";
import { itemsWithStock } from "@/lib/erp/compute";
import { ItemManager } from "@/components/erp/item-manager";

export default async function ItemsPage() {
  const data = await loadErpData();
  return <ItemManager items={itemsWithStock(data)} groups={data.groups} />;
}
