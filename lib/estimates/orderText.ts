import type { SavedEstimateDetail, SavedEstimateItemDetail } from "@/lib/estimates/types";

/**
 * 보관함 견적서 → 카카오톡/문자 발주용 텍스트.
 *
 * 형식(브랜드명 한 줄 → 그 브랜드 품목을 한 줄씩, 브랜드 사이는 빈 줄,
 * 끝에 받는사람 정보):
 *   스쿠버프로
 *   MK25 EVO / 1개 / 블랙
 *   R105 옥토퍼스 / 1개
 *
 *   아쿠아렁
 *   레전드 LX / 2개 / 블랙, L
 *
 *   받는사람: 홍길동
 *   연락처: 010-1234-5678
 *   주소: 광주광역시 서구 ...
 *
 * 가격은 일부러 넣지 않는다 — 발주처에 우리 판매가(등급별 단가)가 노출되지
 * 않도록. 브라우저/서버 어디서나 쓸 수 있는 순수 함수.
 */

export interface SupplierOrderText {
  text: string;
  /** 받는사람 정보 중 비어 있는 항목(예: ["주소"]) — 복사 후 안내용. */
  missingFields: string[];
}

/** 장비명에 브랜드가 이미 들어있지 않으면 앞에 붙인다(발주처가 품목을 헷갈리지 않도록). */
function formatItemName(item: SavedEstimateItemDetail): string {
  const name = item.name.trim();
  const brand = item.brand.trim();
  if (!brand) return name || "(품목명 없음)";
  if (!name) return brand;
  if (name.toLowerCase().includes(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

/**
 * 발주처에 알려줄 필요가 없는 "옵션 없음" 표기. 단일 옵션 상품은 색상/사이즈가
 * "기본"으로 저장되는데, 발주 문구에 "기본"이라고 쓰면 오히려 헷갈리므로 뺀다.
 */
const NO_OPTION_VALUES = new Set(["-", "기본", "기본옵션", "기본형"]);

function isMeaningfulOption(value: string): boolean {
  return value.length > 0 && !NO_OPTION_VALUES.has(value.replace(/\s+/g, ""));
}

/** 색상·사이즈·품목 비고를 "블랙, L, 각인요청" 처럼 쉼표로 이어 붙인다. 없으면 빈 문자열. */
function formatItemOptions(item: SavedEstimateItemDetail): string {
  return [item.color, item.size, item.itemRemarks]
    .map((value) => value?.trim() ?? "")
    .filter(isMeaningfulOption)
    .join(", ");
}

/** 장비명 앞에 브랜드가 이미 붙어 있으면 떼어낸다(브랜드는 묶음 첫 줄에 한 번만 쓰므로). */
function stripLeadingBrand(name: string, brand: string): string {
  if (!brand) return name;
  if (name.toLowerCase().startsWith(brand.toLowerCase())) {
    const rest = name.slice(brand.length).replace(/^[\s\-_/·:]+/, "");
    if (rest) return rest;
  }
  return name;
}

function formatQuantityAndOptions(item: SavedEstimateItemDetail): string {
  const parts = [`${item.quantity}개`];
  const options = formatItemOptions(item);
  if (options) parts.push(options);
  return parts.join(" / ");
}

/**
 * 품목 목록 → 발주 문구 줄들. 같은 브랜드 품목을 처음 나온 순서대로 모아서
 * 브랜드명을 한 줄 쓰고, 그 아래에 "품목 / 수량 / 옵션"을 한 줄씩 쓴다.
 * 브랜드가 바뀌면 빈 줄로 구분한다. 브랜드가 없는 품목(수동 입력 등)은
 * 브랜드 줄 없이 품목 줄만 쓴다.
 */
export function formatOrderItemLines(items: SavedEstimateItemDetail[]): string[] {
  const byBrand = new Map<string, SavedEstimateItemDetail[]>();
  for (const item of items) {
    const brandKey = item.brand.trim().toLowerCase();
    const list = byBrand.get(brandKey);
    if (list) list.push(item);
    else byBrand.set(brandKey, [item]);
  }

  const blocks: string[][] = [];
  for (const group of byBrand.values()) {
    const brand = group[0].brand.trim();
    const block: string[] = brand ? [brand] : [];
    for (const item of group) {
      const name = brand
        ? stripLeadingBrand(item.name.trim(), brand) || "(품목명 없음)"
        : formatItemName(item);
      block.push(`${name} / ${formatQuantityAndOptions(item)}`);
    }
    blocks.push(block);
  }

  return blocks.flatMap((block, index) => (index === 0 ? block : ["", ...block]));
}

export function buildSupplierOrderText(detail: SavedEstimateDetail): SupplierOrderText {
  const itemLines = formatOrderItemLines(detail.items);

  const receiver = detail.receiver;
  const name = receiver?.name?.trim() || detail.receiverName?.trim() || "";
  const contact = receiver?.contact?.trim() ?? "";
  const address = receiver?.address?.trim() ?? "";

  const missingFields: string[] = [];
  if (!name || name === "-") missingFields.push("이름");
  if (!contact) missingFields.push("연락처");
  if (!address) missingFields.push("주소");

  // 비어 있는 항목도 줄은 남겨 둔다 — 붙여넣은 뒤 바로 채워 넣을 수 있도록.
  const receiverLines = [
    `받는사람: ${name && name !== "-" ? name : ""}`,
    `연락처: ${contact}`,
    `주소: ${address}`,
  ];

  return {
    text: [...itemLines, "", ...receiverLines].join("\n"),
    missingFields,
  };
}

// ── 여러 견적서 묶음 발주 ─────────────────────────────────────────────────────

export interface BatchOrderText extends SupplierOrderText {
  /** 받는사람(배송지) 묶음 수 — 2 이상이면 배송지가 여러 곳이라는 뜻. */
  receiverGroupCount: number;
}

/**
 * 여러 견적서를 한 번에 발주할 때 쓰는 텍스트.
 *
 * - 받는사람(이름·연락처·주소)이 같은 견적서끼리 묶는다 — 배송지가 다르면
 *   품목을 합쳐도 의미가 없기 때문.
 * - 같은 묶음 안에서는 품목명·옵션이 완전히 같은 품목의 수량을 합친다.
 * - 배송지가 여러 곳이면 "----------" 구분선으로 나눠 이어 붙인다.
 */
export function buildBatchOrderText(details: SavedEstimateDetail[]): BatchOrderText {
  const groups = new Map<
    string,
    { headerDetail: SavedEstimateDetail; items: Map<string, SavedEstimateItemDetail> }
  >();

  for (const detail of details) {
    const receiver = detail.receiver;
    const receiverKey = [
      receiver?.name?.trim() || detail.receiverName?.trim() || "",
      (receiver?.contact ?? "").replace(/\D/g, ""),
      (receiver?.address ?? "").replace(/\s+/g, ""),
    ].join("|");

    let group = groups.get(receiverKey);
    if (!group) {
      group = { headerDetail: detail, items: new Map() };
      groups.set(receiverKey, group);
    }

    for (const item of detail.items) {
      const itemKey = `${formatItemName(item)}|${formatItemOptions(item)}`;
      const existing = group.items.get(itemKey);
      if (existing) {
        group.items.set(itemKey, { ...existing, quantity: existing.quantity + item.quantity });
      } else {
        group.items.set(itemKey, { ...item });
      }
    }
  }

  const missing = new Set<string>();
  const blocks = [...groups.values()].map((group) => {
    const result = buildSupplierOrderText({
      ...group.headerDetail,
      items: [...group.items.values()],
    });
    result.missingFields.forEach((field) => missing.add(field));
    return result.text;
  });

  return {
    text: blocks.join("\n\n----------\n\n"),
    missingFields: [...missing],
    receiverGroupCount: groups.size,
  };
}
