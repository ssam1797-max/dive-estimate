/**
 * ERP(경영박사 대체) 도메인 타입. Supabase 의 acct_* 테이블과 1:1 로 대응한다.
 * 잔액·재고·전표 합계 같은 파생 값은 저장하지 않고 lib/erp/compute.ts 에서 계산한다.
 */

export const VOUCHER_KINDS = [
  "sale",
  "purchase",
  "receipt",
  "payment",
  "card_receipt",
  "estimate",
] as const;
export type VoucherKind = (typeof VOUCHER_KINDS)[number];

export const VOUCHER_KIND_LABEL: Record<VoucherKind, string> = {
  sale: "매출",
  purchase: "매입",
  receipt: "입금",
  payment: "출금",
  card_receipt: "카드입금",
  estimate: "견적",
};

/** 품목 줄이 있는 전표(매출·매입·견적). 나머지는 금액 한 줄짜리. */
export const ITEMIZED_KINDS: VoucherKind[] = ["sale", "purchase", "estimate"];

export const PARTNER_KINDS = ["customer", "supplier", "consumer", "card", "other"] as const;
export type PartnerKind = (typeof PARTNER_KINDS)[number];

export const PARTNER_KIND_LABEL: Record<PartnerKind, string> = {
  customer: "매출처",
  supplier: "매입처",
  consumer: "소비자",
  card: "카드사",
  other: "기타",
};

/** 경영박사 ITEM.VAT 값 그대로: 0 과세(10%), 1 면세, 3 영세 */
export const VAT_TYPE_LABEL: Record<number, string> = { 0: "과세", 1: "면세", 3: "영세" };

export type Partner = {
  id: number;
  legacy_code: number | null;
  name: string;
  kind: PartnerKind;
  biz_no: string | null;
  rep_name: string | null;
  biz_type: string | null;
  biz_item: string | null;
  zip: string | null;
  address: string | null;
  tel: string | null;
  mobile: string | null;
  fax: string | null;
  email: string | null;
  contact: string | null;
  bank: string | null;
  bank_account: string | null;
  bank_holder: string | null;
  memo: string | null;
  opening_balance: number;
  active: boolean;
};

export type ItemGroup = { id: number; legacy_code: number | null; name: string };

export type Item = {
  id: number;
  legacy_code: number | null;
  sku: string | null;
  group_id: number | null;
  name: string;
  spec: string | null;
  unit: string | null;
  purchase_price: number;
  sale_price: number;
  vat_type: number;
  memo: string | null;
  active: boolean;
  track_stock: boolean;
  opening_stock: number;
};

export type Voucher = {
  id: number;
  voucher_date: string; // YYYY-MM-DD
  voucher_no: number;
  kind: VoucherKind;
  partner_id: number | null;
  card_partner_id: number | null;
  card_fee: number;
  memo: string | null;
  legacy_key: string | null;
  source_voucher_id: number | null;
};

export type VoucherLine = {
  id: number;
  voucher_id: number;
  line_no: number;
  item_id: number | null;
  description: string | null;
  qty: number;
  unit_price: number;
  amount: number;
  vat: number;
};

export type ErpData = {
  partners: Partner[];
  groups: ItemGroup[];
  items: Item[];
  vouchers: Voucher[];
  lines: VoucherLine[];
};

/** 전표 저장 입력값(화면 → 서버). id 가 있으면 수정, 없으면 새로 만든다. */
export type VoucherInput = {
  id?: number;
  voucher_date: string;
  kind: VoucherKind;
  partner_id: number | null;
  card_partner_id: number | null;
  memo: string;
  source_voucher_id?: number | null;
  lines: {
    item_id: number | null;
    description: string;
    qty: number;
    unit_price: number;
    amount: number;
    vat: number;
  }[];
};

export type PartnerInput = Omit<Partner, "id" | "legacy_code"> & { id?: number };
export type ItemInput = Omit<Item, "id" | "legacy_code"> & { id?: number };
