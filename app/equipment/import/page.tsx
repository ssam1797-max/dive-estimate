import { CatalogSyncPanel } from "@/components/equipment/catalog-sync-panel";
import { SyncStatusCard } from "@/components/equipment/sync-status-card";
import {
  getLatestSyncRun,
  getPendingReviewCount,
  getRecentSyncRuns,
} from "@/lib/db/equipment-repo";

export const metadata = { title: "데이터 동기화" };
export const dynamic = "force-dynamic";

const RECENT_RUNS_LIMIT = 5;

export default async function EquipmentImportPage() {
  const [latestRun, recentRuns, pendingReviewCount] = await Promise.all([
    getLatestSyncRun().catch(() => null),
    getRecentSyncRuns(RECENT_RUNS_LIMIT).catch(() => []),
    getPendingReviewCount().catch(() => 0),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <CatalogSyncPanel />
      <SyncStatusCard
        latestRun={latestRun}
        recentRuns={recentRuns}
        pendingReviewCount={pendingReviewCount}
      />
    </div>
  );
}
