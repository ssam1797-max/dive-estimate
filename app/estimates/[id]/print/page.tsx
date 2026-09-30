import { notFound } from "next/navigation";
import { getSavedEstimateDetail } from "@/lib/db/estimate-repo";
import { EstimatePrintView } from "@/components/estimates/estimate-print-view";
import { getIsAdmin } from "@/lib/auth/admin-session";
import { stripCostForViewer } from "@/lib/estimates/adminVisibility";

export const metadata = { title: "견적서 인쇄" };
export const dynamic = "force-dynamic";

export default async function EstimatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [estimate, isAdmin] = await Promise.all([getSavedEstimateDetail(id), getIsAdmin()]);

  if (!estimate) notFound();

  return <EstimatePrintView estimate={stripCostForViewer(estimate, isAdmin)} isAdmin={isAdmin} />;
}
