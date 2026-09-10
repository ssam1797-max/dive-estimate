import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";
import { getProfileById } from "@/lib/db/profile-repo";
import type {
  EstimateItemDraft,
  TemplateSummary,
  TemplateDetail,
  SavedEstimateSummary,
  SavedEstimateDetail,
} from "@/lib/estimates/types";
import type { SaveEstimateItemPayload } from "@/lib/estimates/types";
import type { PriceTier } from "@/lib/estimates/pricing";

// ── 견적서 번호 생성 ──────────────────────────────────────────────────────────

function toYyMmDd(dateStr: string): string {
  const [year, month, day] = dateStr.split("-");
  return `${year.slice(2)}${month}${day}`;
}

export async function getNextEstimateNumber(dateStr: string): Promise<string> {
  const prefix = toYyMmDd(dateStr);

  if (isMockMode()) {
    const used = mockStore.estimates
      .map((e) => e.estimate_number)
      .filter((n) => n.startsWith(`${prefix}-`))
      .map((n) => parseInt(n.split("-")[1] ?? "", 10))
      .filter((n) => Number.isFinite(n));
    const next = used.length > 0 ? Math.max(...used) + 1 : 1;
    return `${prefix}-${String(next).padStart(2, "0")}`;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("estimate_number")
    .like("estimate_number", `${prefix}-%`);
  if (error) throw error;

  const used = (data ?? [])
    .map((r) => r.estimate_number as string | null)
    .filter((v): v is string => typeof v === "string")
    .map((v) => parseInt(v.split("-")[1] ?? "", 10))
    .filter((n) => Number.isFinite(n));

  const next = used.length > 0 ? Math.max(...used) + 1 : 1;
  return `${prefix}-${String(next).padStart(2, "0")}`;
}

// ── 견적서/템플릿 저장 ────────────────────────────────────────────────────────

interface SaveEstimateParams {
  estimateNumber: string | null;
  date: string | null;
  providerId: string | null;
  receiverId: string | null;
  remarks: string | null;
  templateName: string | null;
  priceTier: PriceTier | null;
  items: SaveEstimateItemPayload[];
}

export async function saveEstimate(params: SaveEstimateParams): Promise<string> {
  if (isMockMode()) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const total = params.items.reduce(
      (sum, i) => sum + i.unitPrice * i.quantity,
      0
    );

    // 템플릿 덮어쓰기: 같은 이름 기존 항목 제거
    if (params.templateName) {
      const old = mockStore.estimates.find(
        (e) => e.template_name === params.templateName
      );
      if (old) {
        mockStore.estimateItems = mockStore.estimateItems.filter(
          (i) => i.estimate_id !== old.id
        );
        mockStore.estimates = mockStore.estimates.filter((e) => e.id !== old.id);
      }
    }

    mockStore.estimates.push({
      id,
      estimate_number: params.estimateNumber ?? "",
      date: params.date ?? now.slice(0, 10),
      provider_id: params.providerId ?? "",
      receiver_id: params.receiverId ?? "",
      total_amount: total,
      remarks: params.remarks,
      template_name: params.templateName,
      price_tier: params.priceTier,
      created_at: now,
      updated_at: now,
    });

    for (const item of params.items) {
      mockStore.estimateItems.push({
        id: crypto.randomUUID(),
        estimate_id: id,
        equipment_id: item.equipmentId || null,
        color: item.color || null,
        size: item.size || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        item_remarks: item.itemRemarks || null,
        price_retail: item.priceRetail ?? null,
        price_instructor: item.priceInstructor ?? null,
        price_center: item.priceCenter ?? null,
        price_cost: item.priceCost ?? null,
        created_at: now,
      });
    }

    return id;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc("create_estimate_with_items", {
    p_estimate_number: params.estimateNumber,
    p_date: params.date,
    p_provider_id: params.providerId,
    p_receiver_id: params.receiverId,
    p_remarks: params.remarks,
    p_template_name: params.templateName,
    p_price_tier: params.priceTier,
    p_items: params.items.map((item) => ({
      equipment_id: item.equipmentId,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      item_remarks: item.itemRemarks,
      price_retail: item.priceRetail ?? null,
      price_instructor: item.priceInstructor ?? null,
      price_center: item.priceCenter ?? null,
      price_cost: item.priceCost ?? null,
    })),
  });
  if (error) {
    if (error.code === "23505") throw new Error("이미 사용된 견적서 번호입니다.");
    throw new Error("견적서 저장 중 오류가 발생했습니다.");
  }
  return data as string;
}

// ── 견적서 수정("이어서 작성" 후 덮어쓰기 저장) ────────────────────────────────

interface UpdateEstimateParams {
  estimateNumber: string;
  date: string;
  providerId: string;
  receiverId: string;
  remarks: string;
  priceTier: PriceTier;
  items: SaveEstimateItemPayload[];
}

/**
 * 저장된 실제 견적서(템플릿 제외) 1건을 id 기준으로 통째로 갱신한다.
 * saveEstimate(신규 생성)와는 완전히 분리된 별도 경로라, 기존 신규 저장
 * 흐름(create_estimate_with_items)은 전혀 건드리지 않는다.
 * estimate_items 는 delete 후 재삽입하는 전체 대체 방식 — 견적 목록 편집이
 * "추가/삭제/수정이 뒤섞인 새 배열"을 통째로 넘기는 기존 저장 방식과
 * 일관된다(항목별 diff 를 하지 않음).
 */
export async function updateSavedEstimate(
  id: string,
  params: UpdateEstimateParams
): Promise<string> {
  if (isMockMode()) {
    const idx = mockStore.estimates.findIndex((e) => e.id === id && !e.template_name);
    if (idx === -1) throw new Error("수정할 견적서를 찾을 수 없습니다.");

    const numberTaken = mockStore.estimates.some(
      (e) => e.id !== id && e.estimate_number === params.estimateNumber
    );
    if (numberTaken) throw new Error("이미 사용된 견적서 번호입니다.");

    const now = new Date().toISOString();
    const total = params.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

    mockStore.estimates[idx] = {
      ...mockStore.estimates[idx],
      estimate_number: params.estimateNumber,
      date: params.date,
      provider_id: params.providerId,
      receiver_id: params.receiverId,
      remarks: params.remarks,
      price_tier: params.priceTier,
      total_amount: total,
      updated_at: now,
    };

    mockStore.estimateItems = mockStore.estimateItems.filter((i) => i.estimate_id !== id);
    for (const item of params.items) {
      mockStore.estimateItems.push({
        id: crypto.randomUUID(),
        estimate_id: id,
        equipment_id: item.equipmentId || null,
        color: item.color || null,
        size: item.size || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        item_remarks: item.itemRemarks || null,
        price_retail: item.priceRetail ?? null,
        price_instructor: item.priceInstructor ?? null,
        price_center: item.priceCenter ?? null,
        price_cost: item.priceCost ?? null,
        created_at: now,
      });
    }

    return id;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc("update_estimate_with_items", {
    p_id: id,
    p_estimate_number: params.estimateNumber,
    p_date: params.date,
    p_provider_id: params.providerId,
    p_receiver_id: params.receiverId,
    p_remarks: params.remarks,
    p_price_tier: params.priceTier,
    p_items: params.items.map((item) => ({
      equipment_id: item.equipmentId,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      item_remarks: item.itemRemarks,
      price_retail: item.priceRetail ?? null,
      price_instructor: item.priceInstructor ?? null,
      price_center: item.priceCenter ?? null,
      price_cost: item.priceCost ?? null,
    })),
  });
  if (error) {
    if (error.code === "23505") throw new Error("이미 사용된 견적서 번호입니다.");
    throw new Error("견적서 수정 중 오류가 발생했습니다.");
  }
  return data as string;
}

// ── 템플릿 목록 ───────────────────────────────────────────────────────────────

export async function listTemplateSummaries(): Promise<TemplateSummary[]> {
  if (isMockMode()) {
    return mockStore.estimates
      .filter((e) => e.template_name)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((e) => ({
        id: e.id,
        templateName: e.template_name!,
        itemCount: mockStore.estimateItems.filter((i) => i.estimate_id === e.id).length,
        updatedAt: e.updated_at,
      }));
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("estimates")
    .select("id, template_name, updated_at, estimate_items(count)")
    .not("template_name", "is", null)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as {
    id: string;
    template_name: string | null;
    updated_at: string;
    estimate_items: { count: number }[] | { count: number } | null;
  }[]).map((row) => ({
    id: row.id,
    templateName: row.template_name ?? "",
    itemCount: Array.isArray(row.estimate_items)
      ? (row.estimate_items[0]?.count ?? 0)
      : (row.estimate_items?.count ?? 0),
    updatedAt: row.updated_at,
  }));
}

// ── 템플릿 단건 조회 ──────────────────────────────────────────────────────────

export async function getTemplateWithItems(id: string): Promise<TemplateDetail | null> {
  if (isMockMode()) {
    const estimate = mockStore.estimates.find(
      (e) => e.id === id && e.template_name
    );
    if (!estimate) return null;

    const items = mockStore.estimateItems.filter((i) => i.estimate_id === id);
    const draftItems: EstimateItemDraft[] = items.map((i) => {
      const eq = mockStore.equipment.find((e) => e.id === i.equipment_id);
      return {
        clientId: crypto.randomUUID(),
        equipmentId: i.equipment_id ?? "",
        brand: eq?.brand ?? "",
        category: eq?.category ?? "",
        name: eq?.name ?? "(삭제된 장비)",
        color: i.color ?? "",
        size: i.size ?? "",
        quantity: i.quantity,
        priceRetail: eq?.price_retail ?? i.unit_price,
        unitPrice: i.unit_price,
        itemRemarks: i.item_remarks ?? "",
      };
    });

    return {
      id: estimate.id,
      templateName: estimate.template_name!,
      itemCount: draftItems.length,
      updatedAt: estimate.updated_at,
      items: draftItems,
    };
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id, template_name, updated_at")
    .eq("id", id)
    .not("template_name", "is", null)
    .maybeSingle();

  if (estimateError) throw new Error("템플릿을 불러오지 못했습니다.");
  if (!estimate) return null;

  const { data: items, error: itemsError } = await supabase
    .from("estimate_items")
    .select("equipment_id, color, size, quantity, unit_price, item_remarks, equipment(brand, category, name, price_retail)")
    .eq("estimate_id", id)
    .order("created_at");
  if (itemsError) throw new Error("템플릿 항목을 불러오지 못했습니다.");

  const draftItems: EstimateItemDraft[] = ((items ?? []) as {
    equipment_id: string | null;
    color: string | null;
    size: string | null;
    quantity: number;
    unit_price: number | string;
    item_remarks: string | null;
    equipment: { brand: string; category: string; name: string; price_retail: number }[] | { brand: string; category: string; name: string; price_retail: number } | null;
  }[]).map((row) => {
    const eq = Array.isArray(row.equipment) ? row.equipment[0] : row.equipment;
    return {
      clientId: crypto.randomUUID(),
      equipmentId: row.equipment_id ?? "",
      brand: eq?.brand ?? "",
      category: eq?.category ?? "",
      name: eq?.name ?? "(삭제된 장비)",
      color: row.color ?? "",
      size: row.size ?? "",
      quantity: row.quantity,
      priceRetail: eq?.price_retail ?? Number(row.unit_price),
      unitPrice: Number(row.unit_price),
      itemRemarks: row.item_remarks ?? "",
    };
  });

  return {
    id: estimate.id as string,
    templateName: (estimate.template_name as string) ?? "",
    itemCount: draftItems.length,
    updatedAt: estimate.updated_at as string,
    items: draftItems,
  };
}

// ── 견적서 보관함 (실제 저장된 견적서 — 템플릿 제외) ──────────────────────────

/** [견적서 저장] 으로 저장된 실제 견적서만 최신순으로 나열한다 (template_name 이 있는 행은 템플릿이라 제외). */
/**
 * 견적 항목 배열에서 4개 가격 등급별 합계를 계산한다(보관함 목록 화면의
 * 등급 탭 전환용). 항목별로 저장 시점 등급 스냅샷이 없으면(이 기능 추가
 * 이전에 저장된 견적서) 해당 항목만 unit_price 로 폴백한다 — 항목이 아예
 * 없는 경우(있을 수 없지만 방어적으로)는 4개 등급 모두 fallbackTotal 로 채운다.
 */
function computeTotalsByTier(
  items: {
    quantity: number;
    unit_price: number;
    price_retail: number | null;
    price_instructor: number | null;
    price_center: number | null;
    price_cost: number | null;
  }[],
  fallbackTotal: number
): Record<PriceTier, number> {
  if (items.length === 0) {
    return { RETAIL: fallbackTotal, INSTRUCTOR: fallbackTotal, CENTER: fallbackTotal, COST: fallbackTotal };
  }
  const sum = (pick: (i: (typeof items)[number]) => number | null) =>
    items.reduce((s, i) => s + (pick(i) ?? i.unit_price) * i.quantity, 0);
  return {
    RETAIL: sum((i) => i.price_retail),
    INSTRUCTOR: sum((i) => i.price_instructor),
    CENTER: sum((i) => i.price_center),
    COST: sum((i) => i.price_cost),
  };
}

export async function listSavedEstimates(): Promise<SavedEstimateSummary[]> {
  if (isMockMode()) {
    return mockStore.estimates
      .filter((e) => !e.template_name)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((e) => {
        const provider = mockStore.profiles.find((p) => p.id === e.provider_id);
        const receiver = mockStore.profiles.find((p) => p.id === e.receiver_id);
        const items = mockStore.estimateItems.filter((i) => i.estimate_id === e.id);
        return {
          id: e.id,
          estimateNumber: e.estimate_number,
          date: e.date,
          providerName: provider?.name ?? "-",
          receiverName: receiver?.name ?? "-",
          itemCount: items.length,
          totalAmount: e.total_amount,
          totalsByTier: computeTotalsByTier(
            items.map((i) => ({
              quantity: i.quantity,
              unit_price: i.unit_price,
              price_retail: i.price_retail,
              price_instructor: i.price_instructor,
              price_center: i.price_center,
              price_cost: i.price_cost,
            })),
            e.total_amount
          ),
          createdAt: e.created_at,
        };
      });
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  // provider_id/receiver_id 가 둘 다 같은 profiles 테이블을 가리키므로, Supabase 가
  // 관계를 자동으로 하나만 고르지 못한다 — 별칭(hint) 문법으로 명시한다.
  // (실제 Supabase 로 전환 시 이 FK 제약조건 이름이 스키마와 일치하는지 확인 필요.)
  // estimate_items 는 등급 탭별 합계 계산을 위해 단가 스냅샷까지 함께 가져온다
  // (건수만 필요했던 이전과 달리 count() 임베드 대신 행 전체를 가져온다).
  const { data, error } = await supabase
    .from("estimates")
    .select(
      "id, estimate_number, date, total_amount, created_at, provider:provider_id(name), receiver:receiver_id(name), estimate_items(quantity, unit_price, price_retail, price_instructor, price_center, price_cost)"
    )
    .is("template_name", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return ((data ?? []) as {
    id: string;
    estimate_number: string;
    date: string;
    total_amount: number | string;
    created_at: string;
    provider: { name: string }[] | { name: string } | null;
    receiver: { name: string }[] | { name: string } | null;
    estimate_items: {
      quantity: number;
      unit_price: number | string;
      price_retail: number | string | null;
      price_instructor: number | string | null;
      price_center: number | string | null;
      price_cost: number | string | null;
    }[];
  }[]).map((row) => {
    const provider = Array.isArray(row.provider) ? row.provider[0] : row.provider;
    const receiver = Array.isArray(row.receiver) ? row.receiver[0] : row.receiver;
    const totalAmount = Number(row.total_amount);
    const items = row.estimate_items.map((i) => ({
      quantity: i.quantity,
      unit_price: Number(i.unit_price),
      price_retail: i.price_retail === null ? null : Number(i.price_retail),
      price_instructor: i.price_instructor === null ? null : Number(i.price_instructor),
      price_center: i.price_center === null ? null : Number(i.price_center),
      price_cost: i.price_cost === null ? null : Number(i.price_cost),
    }));
    return {
      id: row.id,
      estimateNumber: row.estimate_number,
      date: row.date,
      providerName: provider?.name ?? "-",
      receiverName: receiver?.name ?? "-",
      itemCount: items.length,
      totalAmount,
      totalsByTier: computeTotalsByTier(items, totalAmount),
      createdAt: row.created_at,
    };
  });
}

/**
 * 보관함에서 특정 견적서 1건의 상세(항목 + 인쇄용 전체 프로필 포함)를 조회한다.
 * 템플릿 행은 대상에서 제외한다.
 *
 * provider/receiver 는 (목록 화면용) 이름 문자열뿐 아니라 인쇄 문서에 필요한
 * 사업번호/주소/도장 등 전체 정보까지 필요해, 이미 검증된 `getProfileById` 를
 * 그대로 재사용한다 (mock/Supabase 양쪽 분기를 중복 구현하지 않기 위함).
 */
export async function getSavedEstimateDetail(id: string): Promise<SavedEstimateDetail | null> {
  if (isMockMode()) {
    const estimate = mockStore.estimates.find((e) => e.id === id && !e.template_name);
    if (!estimate) return null;

    const [provider, receiver] = await Promise.all([
      getProfileById(estimate.provider_id),
      getProfileById(estimate.receiver_id),
    ]);
    const items = mockStore.estimateItems.filter((i) => i.estimate_id === id);

    const detailItems: SavedEstimateDetail["items"] = items.map((i) => {
      const eq = mockStore.equipment.find((e) => e.id === i.equipment_id);
      return {
        equipmentId: i.equipment_id,
        brand: eq?.brand ?? "",
        category: eq?.category ?? "",
        name: eq?.name ?? "(삭제된 장비)",
        color: i.color ?? "",
        size: i.size ?? "",
        quantity: i.quantity,
        unitPrice: i.unit_price,
        itemRemarks: i.item_remarks ?? "",
        priceRetail: i.price_retail,
        priceInstructor: i.price_instructor,
        priceCenter: i.price_center,
        priceCost: i.price_cost,
      };
    });

    return {
      id: estimate.id,
      estimateNumber: estimate.estimate_number,
      date: estimate.date,
      providerName: provider?.name ?? "-",
      receiverName: receiver?.name ?? "-",
      remarks: estimate.remarks ?? "",
      itemCount: detailItems.length,
      totalAmount: estimate.total_amount,
      totalsByTier: computeTotalsByTier(
        items.map((i) => ({
          quantity: i.quantity,
          unit_price: i.unit_price,
          price_retail: i.price_retail,
          price_instructor: i.price_instructor,
          price_center: i.price_center,
          price_cost: i.price_cost,
        })),
        estimate.total_amount
      ),
      createdAt: estimate.created_at,
      items: detailItems,
      provider,
      receiver,
      priceTier: (estimate.price_tier as PriceTier | null) ?? null,
    };
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id, estimate_number, date, remarks, total_amount, created_at, provider_id, receiver_id, price_tier")
    .eq("id", id)
    .is("template_name", null)
    .maybeSingle();

  if (estimateError) throw new Error("견적서를 불러오지 못했습니다.");
  if (!estimate) return null;

  const row = estimate as {
    id: string;
    estimate_number: string;
    date: string;
    remarks: string | null;
    total_amount: number | string;
    created_at: string;
    provider_id: string;
    receiver_id: string;
    price_tier: string | null;
  };

  const [provider, receiver, items] = await Promise.all([
    getProfileById(row.provider_id),
    getProfileById(row.receiver_id),
    supabase
      .from("estimate_items")
      .select(
        "equipment_id, color, size, quantity, unit_price, item_remarks, price_retail, price_instructor, price_center, price_cost, equipment(brand, category, name)"
      )
      .eq("estimate_id", id)
      .order("created_at")
      .then(({ data, error }) => {
        if (error) throw new Error("견적서 항목을 불러오지 못했습니다.");
        return data ?? [];
      }),
  ]);

  const detailItems: SavedEstimateDetail["items"] = (items as {
    equipment_id: string | null;
    color: string | null;
    size: string | null;
    quantity: number;
    unit_price: number | string;
    item_remarks: string | null;
    price_retail: number | string | null;
    price_instructor: number | string | null;
    price_center: number | string | null;
    price_cost: number | string | null;
    equipment: { brand: string; category: string; name: string }[] | { brand: string; category: string; name: string } | null;
  }[]).map((i) => {
    const eq = Array.isArray(i.equipment) ? i.equipment[0] : i.equipment;
    return {
      equipmentId: i.equipment_id,
      brand: eq?.brand ?? "",
      category: eq?.category ?? "",
      name: eq?.name ?? "(삭제된 장비)",
      color: i.color ?? "",
      size: i.size ?? "",
      quantity: i.quantity,
      unitPrice: Number(i.unit_price),
      itemRemarks: i.item_remarks ?? "",
      priceRetail: i.price_retail === null ? null : Number(i.price_retail),
      priceInstructor: i.price_instructor === null ? null : Number(i.price_instructor),
      priceCenter: i.price_center === null ? null : Number(i.price_center),
      priceCost: i.price_cost === null ? null : Number(i.price_cost),
    };
  });

  return {
    id: row.id,
    estimateNumber: row.estimate_number,
    date: row.date,
    providerName: provider?.name ?? "-",
    receiverName: receiver?.name ?? "-",
    remarks: row.remarks ?? "",
    itemCount: detailItems.length,
    totalAmount: Number(row.total_amount),
    totalsByTier: computeTotalsByTier(
      detailItems.map((i) => ({
        quantity: i.quantity,
        unit_price: i.unitPrice,
        price_retail: i.priceRetail,
        price_instructor: i.priceInstructor,
        price_center: i.priceCenter,
        price_cost: i.priceCost,
      })),
      Number(row.total_amount)
    ),
    createdAt: row.created_at,
    priceTier: (row.price_tier as PriceTier | null) ?? null,
    items: detailItems,
    provider,
    receiver,
  };
}

/** 보관함에서 특정 견적서 1건을 삭제한다(항목도 함께 정리). 템플릿 행은 대상에서 제외한다. */
export async function deleteSavedEstimate(id: string): Promise<boolean> {
  if (isMockMode()) {
    const idx = mockStore.estimates.findIndex((e) => e.id === id && !e.template_name);
    if (idx === -1) return false;
    mockStore.estimates.splice(idx, 1);
    mockStore.estimateItems = mockStore.estimateItems.filter((i) => i.estimate_id !== id);
    return true;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  // estimate_items 에 estimates 를 향한 ON DELETE CASCADE 가 없을 수도 있으니
  // 항목을 먼저 지우고 나서 견적서 본체를 지운다(순서가 안전하다).
  const { error: itemsError } = await supabase
    .from("estimate_items")
    .delete()
    .eq("estimate_id", id);
  if (itemsError) throw new Error("견적서 항목 삭제 중 오류가 발생했습니다.");

  const { error, count } = await supabase
    .from("estimates")
    .delete({ count: "exact" })
    .eq("id", id)
    .is("template_name", null);
  if (error) throw new Error("견적서 삭제 중 오류가 발생했습니다.");

  return (count ?? 0) > 0;
}

// ── 템플릿 삭제/이름 변경 ─────────────────────────────────────────────────────
// deleteSavedEstimate 와 반대로, 이 두 함수는 template_name 이 있는 행만
// 대상으로 한다 — 실제 견적서(보관함)를 잘못 건드리지 않도록.

/** 템플릿 1건을 삭제한다(항목도 함께 정리). 존재하지 않거나 템플릿이 아니면 false. */
export async function deleteTemplate(id: string): Promise<boolean> {
  if (isMockMode()) {
    const idx = mockStore.estimates.findIndex((e) => e.id === id && e.template_name);
    if (idx === -1) return false;
    mockStore.estimates.splice(idx, 1);
    mockStore.estimateItems = mockStore.estimateItems.filter((i) => i.estimate_id !== id);
    return true;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { error: itemsError } = await supabase
    .from("estimate_items")
    .delete()
    .eq("estimate_id", id);
  if (itemsError) throw new Error("템플릿 항목 삭제 중 오류가 발생했습니다.");

  const { error, count } = await supabase
    .from("estimates")
    .delete({ count: "exact" })
    .eq("id", id)
    .not("template_name", "is", null);
  if (error) throw new Error("템플릿 삭제 중 오류가 발생했습니다.");

  return (count ?? 0) > 0;
}

/** 템플릿 1건의 이름을 바꾼다. 존재하지 않거나 템플릿이 아니면 false. */
export async function renameTemplate(id: string, templateName: string): Promise<boolean> {
  if (isMockMode()) {
    const row = mockStore.estimates.find((e) => e.id === id && e.template_name);
    if (!row) return false;
    row.template_name = templateName;
    row.updated_at = new Date().toISOString();
    return true;
  }

  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();

  const { error, count } = await supabase
    .from("estimates")
    .update({ template_name: templateName }, { count: "exact" })
    .eq("id", id)
    .not("template_name", "is", null);
  if (error) throw new Error("템플릿 이름 변경 중 오류가 발생했습니다.");

  return (count ?? 0) > 0;
}
