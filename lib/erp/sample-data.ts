import type { ErpData, Partner, Item } from "@/lib/erp/types";

/**
 * Mock 모드(Supabase 환경변수 없음)에서 화면을 확인하기 위한 예시 데이터.
 * 실제 거래처·금액이 아니다. 실제 데이터로 로컬 확인이 필요하면
 * ERP_MOCK_SEED_PATH 에 JSON 스냅샷 경로를 지정한다(저장소에 커밋하지 말 것).
 */
export function buildSampleData(): ErpData {
  const partner = (id: number, name: string, kind: Partner["kind"]): Partner => ({
    id,
    legacy_code: null,
    name,
    kind,
    biz_no: null,
    rep_name: null,
    biz_type: null,
    biz_item: null,
    zip: null,
    address: null,
    tel: null,
    mobile: null,
    fax: null,
    email: null,
    contact: null,
    bank: null,
    bank_account: null,
    bank_holder: null,
    memo: null,
    opening_balance: 0,
    active: true,
  });
  const item = (id: number, name: string, group: number, buy: number, sell: number, track = false): Item => ({
    id,
    legacy_code: null,
    sku: null,
    group_id: group,
    name,
    spec: null,
    unit: "EA",
    purchase_price: buy,
    sale_price: sell,
    vat_type: 1,
    memo: null,
    active: true,
    track_stock: track,
    opening_stock: 0,
  });
  return {
    partners: [
      partner(1, "예시 다이빙샵", "customer"),
      partner(2, "예시 장비 도매", "supplier"),
      partner(3, "예시카드", "card"),
    ],
    groups: [
      { id: 1, legacy_code: null, name: "스쿠버장비" },
      { id: 2, legacy_code: null, name: "교육" },
    ],
    items: [
      item(1, "예시 호흡기", 1, 900000, 1000000, true),
      item(2, "예시 교육과정", 2, 0, 500000),
    ],
    vouchers: [
      { id: 10, voucher_date: "2026-11-02", voucher_no: 1, kind: "purchase", partner_id: 2, card_partner_id: null, card_fee: 0, memo: null, legacy_key: null, source_voucher_id: null },
      { id: 11, voucher_date: "2026-11-05", voucher_no: 1, kind: "sale", partner_id: 1, card_partner_id: null, card_fee: 0, memo: null, legacy_key: null, source_voucher_id: null },
      { id: 12, voucher_date: "2026-11-10", voucher_no: 1, kind: "receipt", partner_id: 1, card_partner_id: null, card_fee: 0, memo: "계좌입금", legacy_key: null, source_voucher_id: null },
      { id: 13, voucher_date: "2026-11-12", voucher_no: 1, kind: "estimate", partner_id: 1, card_partner_id: null, card_fee: 0, memo: null, legacy_key: null, source_voucher_id: null },
    ],
    lines: [
      { id: 100, voucher_id: 10, line_no: 1, item_id: 1, description: null, qty: 2, unit_price: 900000, amount: 1800000, vat: 0 },
      { id: 101, voucher_id: 11, line_no: 1, item_id: 1, description: null, qty: 1, unit_price: 1000000, amount: 1000000, vat: 0 },
      { id: 102, voucher_id: 11, line_no: 2, item_id: 2, description: null, qty: 1, unit_price: 500000, amount: 500000, vat: 0 },
      { id: 103, voucher_id: 12, line_no: 1, item_id: null, description: "입금", qty: 0, unit_price: 0, amount: 1000000, vat: 0 },
      { id: 104, voucher_id: 13, line_no: 1, item_id: 1, description: null, qty: 1, unit_price: 1000000, amount: 1000000, vat: 0 },
    ],
  };
}
