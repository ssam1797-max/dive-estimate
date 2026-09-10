import {
  getEquipmentCatalog,
  getProfilesByType,
  getDiscountPolicyMap,
} from "@/lib/estimates/pageData";
import { listTemplateSummaries } from "@/lib/estimates/templateQueries";
import { getSavedEstimateDetail } from "@/lib/db/estimate-repo";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";
import type {
  EquipmentCatalogItem,
  EstimateItemDraft,
  ProfileOption,
  TemplateSummary,
} from "@/lib/estimates/types";
import { tierPriceOfSnapshot, type DiscountPolicyMap } from "@/lib/estimates/pricing";
import type { EstimateBuilderInitialData } from "@/hooks/use-estimate-builder";

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

/** 서버 시간대와 무관하게 이 앱을 쓰는 다이빙샵 기준(한국) 오늘 날짜를 얻는다. */
function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/**
 * "이 견적서 복제" 진입 시(?duplicateFrom=id) 원본 견적서를 불러와 새 견적서
 * 작성 화면의 초기값으로 변환한다. 날짜는 원본 그대로가 아니라 오늘 날짜로,
 * 견적서 번호는 새로 발급받도록 비워둔다(estimate-builder.tsx 의
 * regenerateEstimateNumber 가 처리) — 공급자/공급받는자/품목/비고/가격
 * 등급만 그대로 가져온다. 원본을 찾지 못하거나 조회에 실패해도 복제 없이
 * 빈 새 견적서로 진행한다(에러로 화면 전체를 막지 않음).
 */
async function loadDuplicateSource(
  id: string
): Promise<EstimateBuilderInitialData | null> {
  try {
    const estimate = await getSavedEstimateDetail(id);
    if (!estimate) return null;

    const priceTier = estimate.priceTier ?? "RETAIL";
    const items: EstimateItemDraft[] = estimate.items.map((item) => ({
      clientId: crypto.randomUUID(),
      equipmentId: item.equipmentId ?? "",
      brand: item.brand,
      category: item.category,
      name: item.name,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      priceRetail: item.priceRetail ?? item.unitPrice,
      unitPrice: tierPriceOfSnapshot(item, priceTier),
      itemRemarks: item.itemRemarks,
    }));

    return {
      date: todayInSeoul(),
      estimateNumber: "",
      providerId: estimate.provider?.id ?? "",
      receiverId: estimate.receiver?.id ?? "",
      remarks: estimate.remarks,
      priceTier,
      items,
    };
  } catch (error) {
    console.error("견적서 복제용 원본 조회 실패:", error);
    return null;
  }
}

/**
 * Supabase 의 PostgrestError 는 Error 를 상속하지 않는 일반 객체라
 * `error instanceof Error` 만으로 걸러내면 message/details 가 그대로 버려지고
 * "알 수 없는 오류"만 남는다. 두 형태(Error 인스턴스 / PostgrestError-like
 * 객체) 모두에서 실제 원인 문자열을 뽑아낸다.
 */
function extractErrorInfo(error: unknown): { message: string; details?: string } {
  if (error instanceof Error) {
    return { message: error.message };
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const extra = [e.details, e.hint, e.code].filter(
      (v): v is string => typeof v === "string" && v.length > 0
    );
    return {
      message: typeof e.message === "string" && e.message ? e.message : "알 수 없는 오류",
      details: extra.length > 0 ? extra.join(" / ") : undefined,
    };
  }
  return { message: "화면에 필요한 데이터를 불러오지 못했습니다." };
}

/** Promise.all 안의 5개 조회 중 어떤 것이 실패했는지 콘솔/화면에서 바로
 *  구분할 수 있도록 각 호출에 라벨을 붙여 감싼다. */
async function loadNamed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const { message, details } = extractErrorInfo(error);
    console.error(`견적서 작성 화면 데이터 조회 실패 [${label}]`, {
      message,
      details,
      raw: error,
    });
    throw new Error(
      details ? `[${label}] ${message} (${details})` : `[${label}] ${message}`
    );
  }
}

async function loadPageData(): Promise<PageData> {
  try {
    const [catalog, providers, receivers, templates, discountPolicies] =
      await Promise.all([
        loadNamed("장비 카탈로그", getEquipmentCatalog),
        loadNamed("공급자 목록", () => getProfilesByType("PROVIDER")),
        loadNamed("수신자 목록", () => getProfilesByType("RECEIVER")),
        loadNamed("템플릿 목록", listTemplateSummaries),
        loadNamed("할인율 정책", getDiscountPolicyMap),
      ]);

    return { catalog, providers, receivers, templates, discountPolicies, loadError: null };
  } catch (error) {
    const { message } = extractErrorInfo(error);
    return {
      catalog: [],
      providers: [],
      receivers: [],
      templates: [],
      discountPolicies: {},
      loadError: message,
    };
  }
}

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: Promise<{ duplicateFrom?: string }>;
}) {
  const { catalog, providers, receivers, templates, discountPolicies, loadError } =
    await loadPageData();
  const { duplicateFrom: duplicateFromId } = await searchParams;
  const duplicateFrom = duplicateFromId
    ? await loadDuplicateSource(duplicateFromId)
    : null;

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
          duplicateFrom={duplicateFrom ?? undefined}
        />
      )}
    </main>
  );
}
