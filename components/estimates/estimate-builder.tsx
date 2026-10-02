"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Save,
  ShoppingCart,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BasicInfoSection } from "@/components/estimates/basic-info-section";
import { EquipmentPicker } from "@/components/estimates/equipment-picker";
import { EstimateItemsTable } from "@/components/estimates/estimate-items-table";
import { PurchaseRequestForm, type PurchaseRequestContact } from "@/components/estimates/purchase-request-form";
import { TemplateSaveDialog } from "@/components/estimates/template-save-dialog";
import { TemplateLoadDialog } from "@/components/estimates/template-load-dialog";
import { ExcelPreviewDialog } from "@/components/estimates/excel-preview-dialog";
import { EstimatePasswordDialog } from "@/components/estimates/estimate-password-dialog";
import { OrderCompleteDialog } from "@/components/estimates/order-complete-dialog";
import { EstimateSaveCompleteDialog } from "@/components/estimates/estimate-save-complete-dialog";
import { generateRandomEstimatePassword } from "@/lib/estimates/estimatePasswordRules";
import { useEstimateBuilder, type EstimateBuilderInitialData } from "@/hooks/use-estimate-builder";
import type {
  EquipmentCatalogItem,
  EstimateItemDraft,
  ExportEstimateItemPayload,
  ProfileOption,
  SaveEstimateItemPayload,
  TemplateDetail,
  TemplateSummary,
} from "@/lib/estimates/types";
import {
  calculateEffectiveUnitPrice,
  type DiscountPolicyMap,
  type PriceTier,
} from "@/lib/estimates/pricing";

interface EstimateBuilderProps {
  catalog: EquipmentCatalogItem[];
  providers: ProfileOption[];
  receivers: ProfileOption[];
  initialTemplates: TemplateSummary[];
  discountPolicies: DiscountPolicyMap;
  /** 관리자 모드 여부 — 원가("COST") 등급은 관리자 모드에서만 선택할 수 있다. */
  isAdmin: boolean;
  /**
   * 저장된 견적서를 "이어서 수정" 하는 경우에만 전달한다. 없으면(undefined)
   * 기존과 완전히 동일한 "신규 견적서 작성" 화면으로 동작한다 — 저장 버튼도
   * 기존 단일 "견적서 저장" 버튼 그대로다.
   */
  editContext?: {
    estimateId: string;
    initialData: EstimateBuilderInitialData;
    /**
     * 비밀번호로 보호된 견적서를 "이어서 수정" 화면 진입 시 미리 확인받은
     * 비밀번호(EstimateEditGate 가 검증 완료 후 전달). 관리자 모드이거나
     * 애초에 비밀번호가 없던 견적서면 undefined.
     */
    currentPassword?: string;
  };
  /**
   * 저장된 견적서를 "복제"해서 새 견적서 작성 화면을 시작하는 경우에만
   * 전달한다. editContext 와 달리 새로 저장 시 항상 새 행이 만들어지고,
   * 견적서 번호도 새로 발급받는다(날짜/공급자/품목 등은 그대로 가져옴).
   */
  duplicateFrom?: EstimateBuilderInitialData;
}

/**
 * 저장 시점에 4개 가격 등급 단가를 전부 스냅샷으로 계산해 함께 저장한다 —
 * 견적서 상세/인쇄 화면에서 등급 탭을 자유롭게 전환해 볼 수 있도록.
 * 현재 화면에 활성화된 등급(activeTier)은 사용자가 단가를 직접 수정했을
 * 수 있으니 item.unitPrice 를 그대로 쓰고, 나머지 3개 등급은
 * calculateEffectiveUnitPrice 로 새로 계산한다.
 */
function toItemPayloads(
  items: {
    equipmentId: string;
    brand: string;
    category: string;
    name: string;
    color: string;
    size: string;
    quantity: number;
    priceRetail: number;
    unitPrice: number;
    itemRemarks: string;
    overrideDiscountRate: number | null;
  }[],
  discountPolicies: DiscountPolicyMap,
  activeTier: PriceTier
): SaveEstimateItemPayload[] {
  return items.map((item) => {
    const tierPrice = (tier: PriceTier) =>
      tier === activeTier
        ? item.unitPrice
        : calculateEffectiveUnitPrice(
            item.priceRetail,
            item.brand,
            tier,
            discountPolicies,
            item.overrideDiscountRate
          );

    return {
      equipmentId: item.equipmentId || null,
      name: item.name,
      brand: item.brand,
      category: item.category,
      color: item.color,
      size: item.size,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      itemRemarks: item.itemRemarks,
      priceRetail: tierPrice("RETAIL"),
      priceInstructor: tierPrice("INSTRUCTOR"),
      priceCenter: tierPrice("CENTER"),
      priceCost: tierPrice("COST"),
    };
  });
}

/** 주문 완료 모달의 "카톡 공유/복사" 버튼에 쓸 주문 내역 텍스트를 만든다. */
function buildOrderSummaryText(
  items: EstimateItemDraft[],
  totalAmount: number,
  contact: PurchaseRequestContact
): string {
  const lines = [
    "[구매요청 주문내역]",
    ...items.map(
      (item) => `- ${item.name} x${item.quantity} : ₩${Math.round(item.unitPrice * item.quantity).toLocaleString("ko-KR")}`
    ),
    `합계: ₩${Math.round(totalAmount).toLocaleString("ko-KR")}`,
    `받는분: ${contact.name} (${contact.phone})`,
    `배송지: ${contact.address}`,
  ];
  return lines.join("\n");
}

function toExportItemPayloads(
  items: {
    brand: string;
    category: string;
    name: string;
    color: string;
    size: string;
    quantity: number;
    priceRetail: number;
    itemRemarks: string;
    overrideDiscountRate: number | null;
  }[]
): ExportEstimateItemPayload[] {
  return items.map((item) => ({
    brand: item.brand,
    category: item.category,
    name: item.name,
    color: item.color,
    size: item.size,
    quantity: item.quantity,
    priceRetail: item.priceRetail,
    itemRemarks: item.itemRemarks,
    overrideDiscountRate: item.overrideDiscountRate,
  }));
}

function extractFileNameFromDisposition(disposition: string | null): string | null {
  if (!disposition) return null;
  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // 무시하고 아래 fallback 으로 진행
    }
  }
  const plainMatch = /filename="?([^";]+)"?/i.exec(disposition);
  return plainMatch?.[1] ?? null;
}

export function EstimateBuilder({
  catalog,
  providers,
  receivers: initialReceivers,
  initialTemplates,
  discountPolicies,
  editContext,
  duplicateFrom,
}: EstimateBuilderProps) {
  const router = useRouter();
  const { state, totalAmount, actions } = useEstimateBuilder(
    discountPolicies,
    editContext?.initialData ?? duplicateFrom,
    // "이어서 수정"(editContext)과 "견적서 복제"(duplicateFrom) 둘 다 오늘
    // 날짜 기준으로 번호를 새로 발급받아야 한다(원본 번호를 그대로 유지하지 않음).
    { regenerateEstimateNumber: !!editContext || !!duplicateFrom }
  );

  // 화면에서 "새로 입력 및 등록"으로 즉시 추가한 공급받는자를 목록에 반영하기 위해
  // props 를 그대로 쓰지 않고 로컬 상태로 들고 있는다.
  const [receivers, setReceivers] = React.useState(initialReceivers);

  const [templates, setTemplates] = React.useState(initialTemplates);
  const [templateSaveOpen, setTemplateSaveOpen] = React.useState(false);
  const [templateLoadOpen, setTemplateLoadOpen] = React.useState(false);

  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  /** [견적서 만들기](신규 저장) 완료 시 완료 모달에 보여줄 정보. */
  const [saveCompleteInfo, setSaveCompleteInfo] = React.useState<{
    estimateNumber: string;
    estimateId: string;
  } | null>(null);

  const [excelPreviewOpen, setExcelPreviewOpen] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportError, setExportError] = React.useState<string | null>(null);

  // 신규 작성(!editContext) 화면의 쇼핑몰식 흐름 전용 — "장바구니에서
  // 구매요청"/"견적서 만들기" 버튼 중 어느 쪽을 눌렀는지, 그 아래 어떤
  // 입력 폼을 보여줄지를 결정한다. "이어서 수정" 화면에서는 쓰지 않는다.
  const [bottomFormMode, setBottomFormMode] = React.useState<"none" | "purchaseRequest" | "basicInfo">(
    "none"
  );
  const cartSectionRef = React.useRef<HTMLDivElement>(null);

  const selectedProvider = React.useMemo(
    () => providers.find((provider) => provider.id === state.providerId) ?? null,
    [providers, state.providerId]
  );
  const selectedReceiver = React.useMemo(
    () => receivers.find((receiver) => receiver.id === state.receiverId) ?? null,
    [receivers, state.receiverId]
  );

  /** 저장 전 공통 검증. 문제가 있으면 에러 메시지를, 없으면 null 을 돌려준다. */
  const validateBeforeSave = (): string | null => {
    if (!state.providerId) return "공급자를 선택해주세요.";
    if (!state.receiverId) return "공급받는자를 선택해주세요.";
    if (!state.estimateNumber) return "견적서 번호가 아직 생성되지 않았습니다. 잠시 후 다시 시도해주세요.";
    if (state.items.length === 0) return "장비를 1개 이상 담아주세요.";
    return null;
  };

  // 신규 저장("견적서 저장")과 "새 견적서로 복사 저장"은 둘 다 새 견적서
  // 행을 만들므로, 저장 직전에 수정/삭제 보호 비밀번호를 새로 설정받아야
  // 한다 — 어느 버튼을 눌렀는지에 따라 비밀번호 확인 후 실행할 동작만 다르다.
  // ("장바구니에서 구매요청"은 고객이 직접 비밀번호를 정할 필요가 없어
  // 별도로 처리한다 — 아래 orderCompleteInfo 참고.)
  const [pendingPasswordAction, setPendingPasswordAction] = React.useState<
    "save" | "saveAsCopy" | null
  >(null);
  /** 구매요청 접수 성공 시 주문 완료 모달에 보여줄 정보. */
  const [orderCompleteInfo, setOrderCompleteInfo] = React.useState<{
    totalAmount: number;
    summaryText: string;
  } | null>(null);

  const performSaveEstimate = async (password: string) => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateNumber: state.estimateNumber,
          date: state.date,
          providerId: state.providerId,
          receiverId: state.receiverId,
          remarks: state.remarks,
          priceTier: state.priceTier,
          items: toItemPayloads(state.items, discountPolicies, state.priceTier),
          editPassword: password,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "견적서 저장에 실패했습니다.");
      }

      setPendingPasswordAction(null);
      setSaveCompleteInfo({ estimateNumber: state.estimateNumber, estimateId: body.id as string });
    } finally {
      setIsSaving(false);
    }
  };

  /** 견적서 저장 완료 모달의 "확인" — 폼을 초기화하고 모달을 닫는다. */
  const performSaveCompleteConfirm = () => {
    actions.resetAfterSave();
    setSaveCompleteInfo(null);
    setBottomFormMode("none");
  };

  const handleSaveEstimate = () => {
    setSaveError(null);

    const validationError = validateBeforeSave();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setPendingPasswordAction("save");
  };

  /** [수정 저장(덮어쓰기)] — 기존 견적서 id 를 유지한 채 estimates/estimate_items 를 갱신한다. */
  const handleUpdateEstimate = async () => {
    if (!editContext) return;
    setSaveError(null);

    const validationError = validateBeforeSave();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/estimates/${editContext.estimateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateNumber: state.estimateNumber,
          date: state.date,
          providerId: state.providerId,
          receiverId: state.receiverId,
          remarks: state.remarks,
          priceTier: state.priceTier,
          items: toItemPayloads(state.items, discountPolicies, state.priceTier),
          currentPassword: editContext.currentPassword,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "견적서 수정에 실패했습니다.");
      }

      router.push(`/estimates/${editContext.estimateId}/print`);
    } catch (error) {
      console.error("견적서 수정 실패:", error);
      setSaveError(
        error instanceof Error ? error.message : "견적서 수정 중 오류가 발생했습니다."
      );
      setIsSaving(false);
    }
  };

  /**
   * [새 견적서로 복사 저장] — 원본은 그대로 두고, 현재 편집 내용으로 새
   * 견적서를 만든다. 원본과 같은 번호를 그대로 쓰면 유니크 제약에 걸리므로,
   * 저장 직전에 현재 폼의 날짜 기준으로 새 번호를 새로 발급받은 뒤 기존
   * "신규 저장"(POST /api/estimates, create_estimate_with_items) 흐름을
   * 그대로 재사용한다 — 복사 저장 전용 서버 로직을 따로 만들지 않는다.
   */
  const performSaveAsCopy = async (password: string) => {
    setIsSaving(true);
    try {
      const numberResponse = await fetch(
        `/api/estimates/next-number?date=${encodeURIComponent(state.date)}`
      );
      const numberBody = await numberResponse.json();
      if (!numberResponse.ok) {
        throw new Error(numberBody?.error ?? "견적서 번호를 생성하지 못했습니다.");
      }
      const freshEstimateNumber = numberBody.estimateNumber as string;

      const response = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateNumber: freshEstimateNumber,
          date: state.date,
          providerId: state.providerId,
          receiverId: state.receiverId,
          remarks: state.remarks,
          priceTier: state.priceTier,
          items: toItemPayloads(state.items, discountPolicies, state.priceTier),
          editPassword: password,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "새 견적서로 저장하지 못했습니다.");
      }

      setPendingPasswordAction(null);
      router.push(`/estimates/${body.id}/print`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAsCopy = () => {
    setSaveError(null);

    const validationError = validateBeforeSave();
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setPendingPasswordAction("saveAsCopy");
  };

  const handleSaveTemplate = async (templateName: string) => {
    if (state.items.length === 0) {
      throw new Error("템플릿으로 저장할 장비가 없습니다. 먼저 장비를 담아주세요.");
    }

    const response = await fetch("/api/estimates/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        templateName,
        items: toItemPayloads(state.items, discountPolicies, state.priceTier),
      }),
    });

    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error ?? "템플릿 저장에 실패했습니다.");
    }

    setTemplates((prev) => [
      {
        id: body.id as string,
        templateName,
        itemCount: state.items.length,
        updatedAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleLoadTemplate = async (templateId: string) => {
    const response = await fetch(`/api/estimates/templates/${templateId}`);
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error ?? "템플릿을 불러오지 못했습니다.");
    }

    const template = body.template as TemplateDetail;
    actions.loadItems(template.items);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    const response = await fetch(`/api/estimates/templates/${templateId}`, {
      method: "DELETE",
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error ?? "템플릿 삭제에 실패했습니다.");
    }

    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  };

  const handleRenameTemplate = async (templateId: string, newName: string) => {
    const response = await fetch(`/api/estimates/templates/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateName: newName }),
    });
    const body = await response.json();

    if (!response.ok) {
      throw new Error(body?.error ?? "템플릿 이름 변경에 실패했습니다.");
    }

    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, templateName: newName } : t))
    );
  };

  const handleCreateReceiver = async (name: string): Promise<ProfileOption> => {
    const response = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "RECEIVER",
        name,
        contact: "",
        address: "",
        stampUrl: "",
        businessNumber: "",
        representative: "",
        businessType: "",
        businessCategory: "",
        email: "",
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.error ?? "공급받는자 등록에 실패했습니다.");
    }

    const created = body.profile as ProfileOption;
    setReceivers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "ko")));
    return created;
  };

  /**
   * [장바구니에서 구매요청] 폼의 "확인" — 공급자는 묻지 않고 등록된 첫
   * 공급자를 그대로 쓰고(정식 견적서가 아니라 접수용이라 굳이 고를 필요가
   * 없다), 입력한 이름/전화번호/배송주소로 공급받는자를 새로 등록한 뒤,
   * 비고에 "[장바구니 구매요청]" 표시를 남겨 보관함에서 구분할 수 있게
   * 한다. 고객이 직접 비밀번호를 정하는 단계 없이(무작위로 하나 만들어
   * 화면에 보여주지 않고 저장만 해둔다 — 관리자 모드는 이 값과 무관하게
   * 항상 수정/삭제 가능) 바로 저장하고, 성공하면 다른 페이지로 옮기지 않고
   * 그 자리에서 주문 완료 모달을 띄운다. 장바구니 비우기는 모달을 닫을 때
   * 한다(performPurchaseRequestConfirm).
   */
  const handlePurchaseRequestSubmit = async (contact: PurchaseRequestContact) => {
    if (state.items.length === 0) {
      throw new Error("장바구니가 비어 있습니다.");
    }
    if (!state.estimateNumber) {
      throw new Error("견적서 번호가 아직 생성되지 않았습니다. 잠시 후 다시 시도해주세요.");
    }
    const defaultProvider = providers[0];
    if (!defaultProvider) {
      throw new Error("등록된 공급자가 없습니다. [공급자/고객 관리] 화면에서 먼저 등록해주세요.");
    }

    const profileResponse = await fetch("/api/profiles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "RECEIVER",
        name: contact.name,
        contact: contact.phone,
        address: contact.address,
        stampUrl: "",
        businessNumber: "",
        representative: "",
        businessType: "",
        businessCategory: "",
        email: "",
      }),
    });
    const profileBody = await profileResponse.json();
    if (!profileResponse.ok) {
      throw new Error(profileBody?.error ?? "구매요청 접수자 등록에 실패했습니다.");
    }
    const createdReceiver = profileBody.profile as ProfileOption;
    setReceivers((prev) =>
      [...prev, createdReceiver].sort((a, b) => a.name.localeCompare(b.name, "ko"))
    );

    const remarksParts = ["[장바구니 구매요청]"];
    if (contact.address) remarksParts.push(`배송지: ${contact.address}`);

    setIsSaving(true);
    try {
      const estimateResponse = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateNumber: state.estimateNumber,
          date: state.date,
          providerId: defaultProvider.id,
          receiverId: createdReceiver.id,
          remarks: remarksParts.join(" "),
          priceTier: state.priceTier,
          items: toItemPayloads(state.items, discountPolicies, state.priceTier),
          editPassword: generateRandomEstimatePassword(),
        }),
      });
      const estimateBody = await estimateResponse.json();
      if (!estimateResponse.ok) {
        throw new Error(estimateBody?.error ?? "구매요청 접수에 실패했습니다.");
      }

      setOrderCompleteInfo({
        totalAmount,
        summaryText: buildOrderSummaryText(state.items, totalAmount, contact),
      });
    } finally {
      setIsSaving(false);
    }
  };

  /** 주문 완료 모달의 "확인" — 장바구니/폼을 초기화하고 모달을 닫는다. */
  const performPurchaseRequestConfirm = () => {
    actions.resetAfterSave();
    setOrderCompleteInfo(null);
    setBottomFormMode("none");
  };

  const handleDownloadExcel = async () => {
    setExportError(null);

    if (!state.providerId) {
      setExportError("공급자를 선택해주세요.");
      return;
    }
    if (!state.receiverId) {
      setExportError("공급받는자를 선택해주세요.");
      return;
    }
    if (!state.estimateNumber) {
      setExportError("견적서 번호가 아직 생성되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }
    if (state.items.length === 0) {
      setExportError("장비를 1개 이상 담아주세요.");
      return;
    }

    setIsExporting(true);
    try {
      const response = await fetch("/api/estimates/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estimateNumber: state.estimateNumber,
          date: state.date,
          providerId: state.providerId,
          receiverId: state.receiverId,
          remarks: state.remarks,
          priceTier: state.priceTier,
          referenceTiers: state.referenceTiers,
          items: toExportItemPayloads(state.items),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "엑셀 파일 생성에 실패했습니다.");
      }

      const fileName =
        extractFileNameFromDisposition(response.headers.get("Content-Disposition")) ??
        `견적서_${state.estimateNumber}.xlsx`;

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("엑셀 다운로드 실패:", error);
      setExportError(
        error instanceof Error ? error.message : "엑셀 다운로드 중 오류가 발생했습니다."
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className={
        // 장바구니에 담긴 게 있으면 좌하단 플로팅 버튼이 떠서, 페이지 맨
        // 아래 콘텐츠(엑셀 미리보기 버튼 등)를 가릴 수 있어 여백을 더 둔다.
        state.items.length > 0 ? "flex flex-col gap-6 pb-24" : "flex flex-col gap-6"
      }
    >
      {editContext && (
        <BasicInfoSection
          date={state.date}
          onDateChange={actions.setDate}
          estimateNumber={state.estimateNumber}
          isEstimateNumberLoading={state.isEstimateNumberLoading}
          estimateNumberError={state.estimateNumberError}
          onRetryEstimateNumber={actions.retryEstimateNumber}
          providers={providers}
          providerId={state.providerId}
          onProviderChange={actions.setProviderId}
          receivers={receivers}
          receiverId={state.receiverId}
          onReceiverChange={actions.setReceiverId}
          onCreateReceiver={handleCreateReceiver}
          remarks={state.remarks}
          onRemarksChange={actions.setRemarks}
          disabled={isSaving}
        />
      )}

      {/* "장비 추가"를 화면 맨 위로 — 쇼핑몰처럼 장비부터 담고, 정보 입력은 맨 마지막에 한다. */}
      <EquipmentPicker
        catalog={catalog}
        onAdd={actions.addItem}
        priceTier={state.priceTier}
        discountPolicies={discountPolicies}
        disabled={isSaving}
      />

      {editContext && (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSaveAsCopy}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="animate-spin" /> : <Copy className="size-4" />}
              새 견적서로 복사 저장
            </Button>
            <Button type="button" onClick={handleUpdateEstimate} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
              수정 저장 (덮어쓰기)
            </Button>
          </div>
        </div>
      )}

      {saveError && <p className="text-sm text-destructive">{saveError}</p>}

      <div ref={cartSectionRef}>
        <EstimateItemsTable
          items={state.items}
          totalAmount={totalAmount}
          discountPolicies={discountPolicies}
          onRemove={actions.removeItem}
          onQuantityChange={actions.updateItemQuantity}
          onUnitPriceChange={actions.updateItemUnitPrice}
          onPriceRetailChange={actions.updateItemPriceRetail}
          onNameChange={actions.updateItemName}
          onColorChange={actions.updateItemColor}
          onSizeChange={actions.updateItemSize}
          onItemRemarksChange={actions.updateItemRemarks}
          onMoveUp={actions.moveItemUp}
          onMoveDown={actions.moveItemDown}
          onClearAll={actions.clearItems}
          disabled={isSaving}
        />
      </div>

      {!editContext && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-yellow-500 hover:border-yellow-500"
              disabled={isSaving || state.items.length === 0}
              onClick={() =>
                setBottomFormMode((prev) => (prev === "purchaseRequest" ? "none" : "purchaseRequest"))
              }
            >
              <ShoppingCart className="size-4" />
              장바구니에서 구매요청
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-yellow-500 hover:border-yellow-500"
              disabled={isSaving || state.items.length === 0}
              onClick={() =>
                setBottomFormMode((prev) => (prev === "basicInfo" ? "none" : "basicInfo"))
              }
            >
              <Save className="size-4" />
              견적서 만들기
            </Button>
          </div>

          {bottomFormMode === "purchaseRequest" && (
            <PurchaseRequestForm disabled={isSaving} onSubmit={handlePurchaseRequestSubmit} />
          )}

          {bottomFormMode === "basicInfo" && (
            <>
              <BasicInfoSection
                date={state.date}
                onDateChange={actions.setDate}
                estimateNumber={state.estimateNumber}
                isEstimateNumberLoading={state.isEstimateNumberLoading}
                estimateNumberError={state.estimateNumberError}
                onRetryEstimateNumber={actions.retryEstimateNumber}
                providers={providers}
                providerId={state.providerId}
                onProviderChange={actions.setProviderId}
                receivers={receivers}
                receiverId={state.receiverId}
                onReceiverChange={actions.setReceiverId}
                onCreateReceiver={handleCreateReceiver}
                remarks={state.remarks}
                onRemarksChange={actions.setRemarks}
                disabled={isSaving}
              />
              <div className="flex justify-end">
                <Button type="button" onClick={handleSaveEstimate} disabled={isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save className="size-4" />}
                  확인 (견적서 저장)
                </Button>
              </div>
            </>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={isExporting}
            onClick={() => setExcelPreviewOpen(true)}
          >
            <FileSpreadsheet className="size-4" />
            엑셀 미리보기
          </Button>
          <Button type="button" onClick={handleDownloadExcel} disabled={isExporting}>
            {isExporting ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            엑셀 다운로드
          </Button>
        </div>
      </div>

      {exportError && <p className="text-sm text-destructive">{exportError}</p>}

      <TemplateSaveDialog
        open={templateSaveOpen}
        onOpenChange={setTemplateSaveOpen}
        onSave={handleSaveTemplate}
      />

      <TemplateLoadDialog
        open={templateLoadOpen}
        onOpenChange={setTemplateLoadOpen}
        templates={templates}
        onSelect={handleLoadTemplate}
        onDelete={handleDeleteTemplate}
        onRename={handleRenameTemplate}
      />

      <ExcelPreviewDialog
        open={excelPreviewOpen}
        onOpenChange={setExcelPreviewOpen}
        estimateNumber={state.estimateNumber}
        date={state.date}
        provider={selectedProvider}
        receiver={selectedReceiver}
        remarks={state.remarks}
        priceTier={state.priceTier}
        referenceTiers={state.referenceTiers}
        items={state.items}
        discountPolicies={discountPolicies}
      />

      <EstimatePasswordDialog
        open={pendingPasswordAction !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPasswordAction(null);
        }}
        title="견적서 비밀번호 설정"
        description="나중에 이 견적서를 수정하거나 삭제할 때 필요합니다."
        onSubmit={async (password) => {
          if (pendingPasswordAction === "save") await performSaveEstimate(password);
          else if (pendingPasswordAction === "saveAsCopy") await performSaveAsCopy(password);
        }}
      />

      <OrderCompleteDialog
        open={orderCompleteInfo !== null}
        totalAmount={orderCompleteInfo?.totalAmount ?? 0}
        orderSummaryText={orderCompleteInfo?.summaryText ?? ""}
        onConfirm={performPurchaseRequestConfirm}
      />

      <EstimateSaveCompleteDialog
        open={saveCompleteInfo !== null}
        estimateNumber={saveCompleteInfo?.estimateNumber ?? ""}
        printUrl={
          saveCompleteInfo
            ? `${typeof window !== "undefined" ? window.location.origin : ""}/estimates/${saveCompleteInfo.estimateId}/print`
            : ""
        }
        onConfirm={performSaveCompleteConfirm}
      />

      {state.items.length > 0 && (
        <button
          type="button"
          onClick={() =>
            cartSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          // 우측 하단은 Netlify 배포 사이트의 "Powered by Netlify" 배지가
          // 차지하고 있어(실제 배포본에서 확인), 겹치지 않도록 좌측 하단에 둔다.
          className="fixed bottom-6 left-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 print:hidden"
        >
          🛒 장바구니 ({state.items.length}개)
        </button>
      )}
    </div>
  );
}
