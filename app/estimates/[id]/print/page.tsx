import { notFound } from "next/navigation";
import { getSavedEstimateDetail } from "@/lib/db/estimate-repo";
import { EstimatePrintView } from "@/components/estimates/estimate-print-view";

export const metadata = { title: "견적서 인쇄" };
export const dynamic = "force-dynamic";

export default async function EstimatePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const estimate = await getSavedEstimateDetail(id);

  if (!estimate) notFound();

  return <EstimatePrintView estimate={estimate} />;
}
