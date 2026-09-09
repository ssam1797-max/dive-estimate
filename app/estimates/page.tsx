import { listSavedEstimates } from "@/lib/db/estimate-repo";
import { isMockMode } from "@/lib/db/is-mock";
import { EstimateArchiveTable } from "@/components/estimates/estimate-archive-table";
import type { SavedEstimateSummary } from "@/lib/estimates/types";

export const metadata = { title: "견적서 보관함" };
export const dynamic = "force-dynamic";

export default async function EstimateArchivePage() {
  let estimates: SavedEstimateSummary[] = [];
  let loadError = false;
  const mockMode = isMockMode();

  try {
    estimates = await listSavedEstimates();
  } catch (error) {
    console.error("견적서 보관함 목록 조회 실패:", error);
    loadError = true;
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">견적서 보관함</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          [견적서 작성] 화면에서 저장한 견적서 목록입니다. 항목을 눌러 담겼던
          장비 내역을 확인할 수 있습니다.
        </p>
      </div>

      {mockMode && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Mock 모드</strong> — Supabase 환경변수가 설정되지 않아 인메모리 데이터를 사용합니다.
          변경사항은 서버가 재시작되면 초기화됩니다.
        </div>
      )}

      {loadError ? (
        <p className="text-sm text-destructive">
          견적서 목록을 불러오지 못했습니다. 환경 설정을 확인해주세요.
        </p>
      ) : (
        <EstimateArchiveTable initialEstimates={estimates} />
      )}
    </main>
  );
}
