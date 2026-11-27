import { loadErpData } from "@/lib/erp/repo";
import { itemsWithStock, partnersWithBalance } from "@/lib/erp/compute";
import { todayKST } from "@/lib/erp/format";
import { VOUCHER_KINDS, type VoucherKind } from "@/lib/erp/types";
import { VoucherForm } from "@/components/erp/voucher-form";

export default async function NewVoucherPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; partner?: string }>;
}) {
  const sp = await searchParams;
  const data = await loadErpData();
  const kind = VOUCHER_KINDS.includes(sp.kind as VoucherKind) ? (sp.kind as VoucherKind) : "sale";
  return (
    <VoucherForm
      partners={partnersWithBalance(data)}
      items={itemsWithStock(data)}
        groups={data.groups}
      defaultDate={todayKST()}
      defaultKind={kind}
      defaultPartnerId={sp.partner ? Number(sp.partner) : null}
    />
  );
}
