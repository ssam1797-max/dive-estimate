"use server";

import { revalidatePath } from "next/cache";
import { getIsAdmin } from "@/lib/auth/admin-session";
import { todayKST } from "@/lib/erp/format";
import * as repo from "@/lib/erp/repo";
import {
  VOUCHER_KINDS,
  PARTNER_KINDS,
  type ItemInput,
  type PartnerInput,
  type VoucherInput,
} from "@/lib/erp/types";

export type ActionResult = { ok: true; id: number } | { ok: false; error: string };

async function guard() {
  if (!(await getIsAdmin())) throw new Error("관리자 모드에서만 사용할 수 있습니다. 먼저 관리자 로그인을 해주세요.");
}

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

/** 빈칸·잘못된 값이면 null(= A 가격 사용) */
function optionalPrice(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function saveVoucherAction(input: VoucherInput): Promise<ActionResult> {
  try {
    await guard();
    if (!VOUCHER_KINDS.includes(input.kind)) throw new Error("전표 종류가 올바르지 않습니다.");
    if (!DATE_RE.test(input.voucher_date)) throw new Error("날짜를 확인해주세요.");
    if (!input.partner_id) throw new Error("거래처를 선택해주세요.");
    if (input.kind === "card_receipt" && !input.card_partner_id) throw new Error("카드사를 선택해주세요.");
    const id = await repo.saveVoucher(input);
    revalidatePath("/erp", "layout");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteVoucherAction(id: number): Promise<ActionResult> {
  try {
    await guard();
    await repo.deleteVoucher(id);
    revalidatePath("/erp", "layout");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function convertEstimateAction(
  id: number,
  kind: "sale" | "purchase"
): Promise<ActionResult> {
  try {
    await guard();
    if (kind !== "sale" && kind !== "purchase") throw new Error("전환할 종류가 올바르지 않습니다.");
    const newId = await repo.convertEstimate(id, kind, todayKST());
    revalidatePath("/erp", "layout");
    return { ok: true, id: newId };
  } catch (e) {
    return fail(e);
  }
}

export async function savePartnerAction(input: PartnerInput): Promise<ActionResult> {
  try {
    await guard();
    if (!PARTNER_KINDS.includes(input.kind)) throw new Error("거래처 구분이 올바르지 않습니다.");
    const id = await repo.savePartner({
      ...input,
      opening_balance: Number(input.opening_balance) || 0,
      price_grade: input.price_grade === "B" || input.price_grade === "C" ? input.price_grade : "A",
    });
    revalidatePath("/erp", "layout");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function saveItemAction(input: ItemInput): Promise<ActionResult> {
  try {
    await guard();
    const id = await repo.saveItem({
      ...input,
      purchase_price: Number(input.purchase_price) || 0,
      sale_price: Number(input.sale_price) || 0,
      sale_price_b: optionalPrice(input.sale_price_b),
      sale_price_c: optionalPrice(input.sale_price_c),
      opening_stock: Number(input.opening_stock) || 0,
      consumer_price: optionalPrice(input.consumer_price),
      min_stock: optionalPrice(input.min_stock),
      vat_type: [0, 1, 3].includes(Number(input.vat_type)) ? Number(input.vat_type) : 1,
    });
    revalidatePath("/erp", "layout");
    return { ok: true, id };
  } catch (e) {
    return fail(e);
  }
}

export async function changeVouchersAction(
  ids: number[],
  change: { date?: string; kind?: (typeof VOUCHER_KINDS)[number] }
): Promise<ActionResult> {
  try {
    await guard();
    if (!Array.isArray(ids) || ids.length === 0) throw new Error("바꿀 전표를 골라주세요.");
    if (!change.date && !change.kind) throw new Error("바꿀 날짜나 종류를 정해주세요.");
    if (change.date && !DATE_RE.test(change.date)) throw new Error("날짜를 확인해주세요.");
    if (change.kind && !VOUCHER_KINDS.includes(change.kind)) throw new Error("전표 종류가 올바르지 않습니다.");
    const n = await repo.changeVouchers(ids.map(Number), change);
    revalidatePath("/erp", "layout");
    return { ok: true, id: n };
  } catch (e) {
    return fail(e);
  }
}
