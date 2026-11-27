import "server-only";
import { readFileSync } from "fs";
import { isMockMode } from "@/lib/db/is-mock";
import { createAdminClient } from "@/lib/supabase/server";
import { nextVoucherNo } from "@/lib/erp/compute";
import { buildSampleData } from "@/lib/erp/sample-data";
import type {
  ErpData,
  Item,
  ItemInput,
  Partner,
  PartnerInput,
  Voucher,
  VoucherInput,
  VoucherKind,
  VoucherLine,
} from "@/lib/erp/types";

/**
 * ERP 데이터 접근 계층. 실제 DB 모드에서는 서비스 롤 키(createAdminClient)로
 * acct_* 테이블을 읽고 쓰며, 호출하는 쪽(서버 액션·페이지)에서 반드시
 * 관리자 세션을 먼저 확인한다. Mock 모드에서는 메모리 안의 예시 데이터를 쓴다.
 */

const num = (v: unknown) => (v == null ? 0 : Number(v));

function normalize(raw: ErpData): ErpData {
  return {
    partners: raw.partners.map((p) => ({ ...p, opening_balance: num(p.opening_balance) })),
    groups: raw.groups,
    items: raw.items.map((i) => ({
      ...i,
      purchase_price: num(i.purchase_price),
      sale_price: num(i.sale_price),
      opening_stock: num(i.opening_stock),
      track_stock: Boolean(i.track_stock),
    })),
    vouchers: raw.vouchers.map((v) => ({ ...v, card_fee: num(v.card_fee) })),
    lines: raw.lines.map((l) => ({
      ...l,
      qty: num(l.qty),
      unit_price: num(l.unit_price),
      amount: num(l.amount),
      vat: num(l.vat),
    })),
  };
}

// ---------------------------------------------------------------- Mock store
type MockStore = { data: ErpData; seq: number };
const g = globalThis as unknown as { __erpMock?: MockStore };

function mockStore(): MockStore {
  if (!g.__erpMock) {
    let data: ErpData;
    const seedPath = process.env.ERP_MOCK_SEED_PATH;
    if (seedPath) {
      data = normalize(JSON.parse(readFileSync(seedPath, "utf8")) as ErpData);
    } else {
      data = buildSampleData();
    }
    const maxId = Math.max(
      0,
      ...data.vouchers.map((v) => v.id),
      ...data.lines.map((l) => l.id),
      ...data.partners.map((p) => p.id),
      ...data.items.map((i) => i.id)
    );
    g.__erpMock = { data, seq: maxId + 1 };
  }
  return g.__erpMock;
}

// ---------------------------------------------------------------- Supabase helpers
async function selectAll<T>(table: string, columns = "*"): Promise<T[]> {
  const supabase = await createAdminClient();
  const out: T[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .order("id", { ascending: true })
      .range(from, from + page - 1);
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    out.push(...((data ?? []) as T[]));
    if (!data || data.length < page) break;
  }
  return out;
}

// ---------------------------------------------------------------- Public API
export async function loadErpData(): Promise<ErpData> {
  if (isMockMode()) return structuredClone(mockStore().data);
  const [partners, groups, items, vouchers, lines] = await Promise.all([
    selectAll<Partner>("acct_partners"),
    selectAll<{ id: number; legacy_code: number | null; name: string }>("acct_item_groups"),
    selectAll<Item>("acct_items"),
    selectAll<Voucher>("acct_vouchers"),
    selectAll<VoucherLine>("acct_voucher_lines"),
  ]);
  return normalize({ partners, groups, items, vouchers, lines });
}

function cleanLines(input: VoucherInput) {
  return input.lines
    .filter((l) => l.item_id != null || l.description.trim() !== "" || l.amount !== 0)
    .map((l, i) => ({
      line_no: i + 1,
      item_id: l.item_id,
      description: l.description.trim() || null,
      qty: Number(l.qty) || 0,
      unit_price: Number(l.unit_price) || 0,
      amount: Math.round(Number(l.amount) || 0),
      vat: Math.round(Number(l.vat) || 0),
    }));
}

/** 전표를 저장하고 id 를 돌려준다. 수정할 때는 줄을 통째로 바꾼다. */
export async function saveVoucher(input: VoucherInput): Promise<number> {
  const lines = cleanLines(input);
  const header = {
    voucher_date: input.voucher_date,
    kind: input.kind,
    partner_id: input.partner_id,
    card_partner_id: input.kind === "card_receipt" ? input.card_partner_id : null,
    memo: input.memo.trim() || null,
  };

  if (isMockMode()) {
    const store = mockStore();
    const d = store.data;
    let id = input.id;
    if (id) {
      const v = d.vouchers.find((x) => x.id === id);
      if (!v) throw new Error("전표를 찾을 수 없습니다.");
      if (v.voucher_date !== header.voucher_date) v.voucher_no = nextVoucherNo(d, header.voucher_date);
      Object.assign(v, header);
      d.lines = d.lines.filter((l) => l.voucher_id !== id);
    } else {
      id = store.seq++;
      d.vouchers.push({
        id,
        ...header,
        voucher_no: nextVoucherNo(d, header.voucher_date),
        card_fee: 0,
        legacy_key: null,
        source_voucher_id: input.source_voucher_id ?? null,
      });
    }
    for (const l of lines) d.lines.push({ id: store.seq++, voucher_id: id, ...l });
    return id;
  }

  // 머리 저장 + 줄 교체를 DB 함수 하나(한 트랜잭션)로 처리한다.
  // 중간에 실패하면 전부 취소되어 기존 전표가 그대로 남는다.
  const supabase = await createAdminClient();
  const { data, error } = await supabase.rpc("acct_save_voucher", {
    p: { ...header, id: input.id ?? null, source_voucher_id: input.source_voucher_id ?? null, lines },
  });
  if (error) throw new Error(`전표 저장 실패: ${error.message}`);
  return Number(data);
}

export async function deleteVoucher(id: number): Promise<void> {
  if (isMockMode()) {
    const d = mockStore().data;
    d.lines = d.lines.filter((l) => l.voucher_id !== id);
    d.vouchers = d.vouchers.filter((v) => v.id !== id);
    for (const v of d.vouchers) if (v.source_voucher_id === id) v.source_voucher_id = null;
    return;
  }
  // 줄은 FK(ON DELETE CASCADE)로 함께 지워지므로 한 문장으로 끝난다.
  const supabase = await createAdminClient();
  const { error } = await supabase.from("acct_vouchers").delete().eq("id", id);
  if (error) throw new Error(`전표 삭제 실패: ${error.message}`);
}

/** 견적을 같은 내용의 매출/매입 전표로 복사한다(원본 견적은 그대로 남는다). */
export async function convertEstimate(
  estimateId: number,
  kind: Extract<VoucherKind, "sale" | "purchase">,
  date: string
): Promise<number> {
  const data = await loadErpData();
  const est = data.vouchers.find((v) => v.id === estimateId);
  if (!est || est.kind !== "estimate") throw new Error("견적 전표를 찾을 수 없습니다.");
  const lines = data.lines
    .filter((l) => l.voucher_id === estimateId)
    .sort((a, b) => a.line_no - b.line_no);
  return saveVoucher({
    voucher_date: date,
    kind,
    partner_id: est.partner_id,
    card_partner_id: null,
    memo: est.memo ?? "",
    source_voucher_id: estimateId,
    lines: lines.map((l) => ({
      item_id: l.item_id,
      description: l.description ?? "",
      qty: l.qty,
      unit_price: l.unit_price,
      amount: l.amount,
      vat: l.vat,
    })),
  });
}

function blankToNull<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = typeof v === "string" && v.trim() === "" ? null : v;
  return out as T;
}

export async function savePartner(input: PartnerInput): Promise<number> {
  const { id, ...rest } = input;
  const row = blankToNull({ ...rest, name: rest.name.trim() });
  if (!row.name) throw new Error("거래처 이름을 입력해주세요.");
  if (isMockMode()) {
    const store = mockStore();
    if (id) {
      const p = store.data.partners.find((x) => x.id === id);
      if (!p) throw new Error("거래처를 찾을 수 없습니다.");
      Object.assign(p, row);
      return id;
    }
    const newId = store.seq++;
    store.data.partners.push({ id: newId, legacy_code: null, ...row } as Partner);
    return newId;
  }
  const supabase = await createAdminClient();
  if (id) {
    const { error } = await supabase.from("acct_partners").update(row).eq("id", id);
    if (error) throw new Error(`거래처 수정 실패: ${error.message}`);
    return id;
  }
  const { data, error } = await supabase.from("acct_partners").insert(row).select("id").single();
  if (error) throw new Error(`거래처 저장 실패: ${error.message}`);
  return data.id as number;
}

export async function saveItem(input: ItemInput): Promise<number> {
  const { id, ...rest } = input;
  const row = blankToNull({ ...rest, name: rest.name.trim() });
  if (!row.name) throw new Error("품목 이름을 입력해주세요.");
  if (isMockMode()) {
    const store = mockStore();
    if (id) {
      const it = store.data.items.find((x) => x.id === id);
      if (!it) throw new Error("품목을 찾을 수 없습니다.");
      Object.assign(it, row);
      return id;
    }
    const newId = store.seq++;
    store.data.items.push({ id: newId, legacy_code: null, ...row } as Item);
    return newId;
  }
  const supabase = await createAdminClient();
  if (id) {
    const { error } = await supabase.from("acct_items").update(row).eq("id", id);
    if (error) throw new Error(`품목 수정 실패: ${error.message}`);
    return id;
  }
  const { data, error } = await supabase.from("acct_items").insert(row).select("id").single();
  if (error) throw new Error(`품목 저장 실패: ${error.message}`);
  return data.id as number;
}
