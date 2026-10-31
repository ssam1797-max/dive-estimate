import type { SavedEstimateDetail, SavedEstimateItemDetail } from "@/lib/estimates/types";

/**
 * 보관함 견적서 → 카카오톡/문자 발주용 텍스트.
 *
 * 형식(품목마다 한 줄, 끝에 받는사람 정보):
 *   아쿠아렁 레전드 LX / 2개 / 블랙, L
 *   스쿠버프로 MK25 / 1개
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

/** 색상·사이즈·품목 비고를 "블랙, L, 각인요청" 처럼 쉼표로 이어 붙인다. 없으면 빈 문자열. */
function formatItemOptions(item: SavedEstimateItemDetail): string {
  return [item.color, item.size, item.itemRemarks]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0 && value !== "-")
    .join(", ");
}

export function formatOrderItemLine(item: SavedEstimateItemDetail): string {
  const parts = [formatItemName(item), `${item.quantity}개`];
  const options = formatItemOptions(item);
  if (options) parts.push(options);
  return parts.join(" / ");
}

export function buildSupplierOrderText(detail: SavedEstimateDetail): SupplierOrderText {
  const itemLines = detail.items.map(formatOrderItemLine);

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
