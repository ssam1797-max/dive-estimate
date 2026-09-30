import { getAllDiscountPolicies } from "@/lib/db/discount-policy-repo";
import { getEquipmentBrands } from "@/lib/db/equipment-repo";
import { isMockMode } from "@/lib/db/is-mock";
import { DiscountPolicyTable } from "@/components/discount-policies/discount-policy-table";
import type { PolicyRow } from "@/components/discount-policies/discount-policy-table";
import { getIsAdmin } from "@/lib/auth/admin-session";

export const metadata = { title: "브랜드별 할인율 설정" };
export const dynamic = "force-dynamic";

export default async function DiscountPoliciesPage() {
  let policies: PolicyRow[] = [];
  let allBrands: string[] = [];
  let loadError = false;
  const mockMode = isMockMode();
  const isAdmin = await getIsAdmin();

  if (isAdmin) {
    try {
      const [rawPolicies, eqBrands] = await Promise.all([
        getAllDiscountPolicies(),
        getEquipmentBrands(),
      ]);
      policies = rawPolicies.map((p) => ({
        brand: p.brand,
        aliases: p.aliases,
        rate_retail: p.rate_retail,
        rate_instructor: p.rate_instructor,
        rate_center: p.rate_center,
        rate_cost: p.rate_cost,
      }));
      allBrands = [...new Set([...eqBrands, ...rawPolicies.map((p) => p.brand)])].sort();
    } catch {
      loadError = true;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">브랜드별 할인율 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          견적서 작성 시 적용할 브랜드별 가격 정책(소비자가·샵가·공급가·원가 할인율)을 관리합니다.
          각 행에서 값을 수정한 뒤 [저장] 버튼을 누르세요. 장비 마스터의 브랜드 표기가
          정책 브랜드명과 대소문자·언어가 다르면(예: &quot;SCUBAPRO&quot; vs
          &quot;Scubapro&quot;, &quot;마레스&quot; vs &quot;Mares&quot;) &quot;별칭&quot;
          칸에 콤마로 구분해 추가로 등록하세요.
        </p>
      </div>

      {mockMode && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Mock 모드</strong> — Supabase 환경변수가 설정되지 않아 인메모리 데이터를 사용합니다.
          변경사항은 서버가 재시작되면 초기화됩니다.
          <code className="ml-1 rounded bg-amber-100 px-1 text-xs dark:bg-amber-900">.env.local</code>에
          실제 키를 입력하면 즉시 실제 DB로 전환됩니다.
        </div>
      )}

      {!isAdmin ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          브랜드 할인율 설정은 관리자 모드에서만 이용할 수 있습니다. 상단
          &quot;관리자 모드&quot; 버튼으로 로그인해주세요.
        </p>
      ) : loadError ? (
        <p className="text-sm text-destructive">
          데이터를 불러오지 못했습니다. 환경 설정을 확인해주세요.
        </p>
      ) : (
        <DiscountPolicyTable initialPolicies={policies} allBrands={allBrands} isAdmin={isAdmin} />
      )}
    </main>
  );
}
