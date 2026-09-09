import {
  getEquipmentCatalog,
  getProfilesByType,
  getDiscountPolicyMap,
} from "@/lib/estimates/pageData";
import { listTemplateSummaries } from "@/lib/estimates/templateQueries";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import type {
  EquipmentCatalogItem,
  ProfileOption,
  TemplateSummary,
} from "@/lib/estimates/types";
import type { DiscountPolicyMap } from "@/lib/estimates/pricing";

export const metadata = {
  title: "견적서 작성",
};

// 이 페이지는 admin 클라이언트(쿠키 미사용)로 DB를 읽기 때문에 Next.js 가
// 정적 페이지로 착각해 빌드 시점 데이터로 캐시할 수 있습니다. 장비 카탈로그,
// 공급자/수신자 목록, 템플릿 목록은 항상 최신이어야 하므로 동적 렌더링을 강제합니다.
export const dynamic = "force-dynamic";

interface PageData {
  catalog: EquipmentCatalogItem[];
  providers: ProfileOption[];
  receivers: ProfileOption[];
  templates: TemplateSummary[];
  discountPolicies: DiscountPolicyMap;
  loadError: string | null;
}

async function loadPageData(): Promise<PageData> {
  try {
    const [catalog, providers, receivers, templates, discountPolicies] =
      await Promise.all([
        getEquipmentCatalog(),
        getProfilesByType("PROVIDER"),
        getProfilesByType("RECEIVER"),
        listTemplateSummaries(),
        getDiscountPolicyMap(),
      ]);

    return { catalog, providers, receivers, templates, discountPolicies, loadError: null };
  } catch (error) {
    console.error("견적서 작성 화면 데이터 조회 실패:", error);
    return {
      catalog: [],
      providers: [],
      receivers: [],
      templates: [],
      discountPolicies: {},
      loadError:
        error instanceof Error
          ? error.message
          : "화면에 필요한 데이터를 불러오지 못했습니다.",
    };
  }
}

export default async function NewEstimatePage() {
  const { catalog, providers, receivers, templates, discountPolicies, loadError } =
    await loadPageData();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">견적서 작성</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          기본 정보를 입력하고 장비를 담아 견적서를 작성하세요. 자주 쓰는
          구성은 템플릿으로 저장해두면 다음에 바로 불러올 수 있습니다.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : (
        <EstimateBuilder
          catalog={catalog}
          providers={providers}
          receivers={receivers}
          initialTemplates={templates}
          discountPolicies={discountPolicies}
        />
      )}
    </main>
  );
}
