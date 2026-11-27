import ExcelJS from "exceljs";
import { requireAdmin } from "@/lib/auth/admin-session";
import { loadErpData } from "@/lib/erp/repo";
import { itemsWithStock, partnersWithBalance } from "@/lib/erp/compute";
import { todayKST } from "@/lib/erp/format";
import { PARTNER_KIND_LABEL, VAT_TYPE_LABEL, VOUCHER_KIND_LABEL } from "@/lib/erp/types";

export const dynamic = "force-dynamic";

/** 장부 전체를 엑셀(시트: 전표·거래처·품목)로 내려받는 백업 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const data = await loadErpData();
  const wb = new ExcelJS.Workbook();
  const partnerName = new Map(data.partners.map((p) => [p.id, p.name]));
  const itemName = new Map(data.items.map((i) => [i.id, i.name]));
  const vById = new Map(data.vouchers.map((v) => [v.id, v]));

  const ws = wb.addWorksheet("전표");
  ws.columns = [
    { header: "날짜", key: "date", width: 12 },
    { header: "번호", key: "no", width: 6 },
    { header: "종류", key: "kind", width: 9 },
    { header: "거래처", key: "partner", width: 22 },
    { header: "카드사", key: "card", width: 12 },
    { header: "품목", key: "item", width: 32 },
    { header: "적요", key: "desc", width: 24 },
    { header: "수량", key: "qty", width: 8 },
    { header: "단가", key: "price", width: 12 },
    { header: "공급가", key: "amount", width: 13 },
    { header: "부가세", key: "vat", width: 11 },
    { header: "합계", key: "total", width: 13 },
    { header: "전표메모", key: "memo", width: 24 },
    { header: "전표ID", key: "vid", width: 8 },
  ];
  const lines = [...data.lines].sort((a, b) => {
    const va = vById.get(a.voucher_id)!;
    const vb = vById.get(b.voucher_id)!;
    return va.voucher_date === vb.voucher_date
      ? va.voucher_no - vb.voucher_no || a.line_no - b.line_no
      : va.voucher_date < vb.voucher_date
        ? -1
        : 1;
  });
  for (const l of lines) {
    const v = vById.get(l.voucher_id);
    if (!v) continue;
    ws.addRow({
      date: v.voucher_date,
      no: v.voucher_no,
      kind: VOUCHER_KIND_LABEL[v.kind],
      partner: v.partner_id ? partnerName.get(v.partner_id) : "",
      card: v.card_partner_id ? partnerName.get(v.card_partner_id) : "",
      item: l.item_id ? itemName.get(l.item_id) : "",
      desc: l.description ?? "",
      qty: l.qty,
      price: l.unit_price,
      amount: l.amount,
      vat: l.vat,
      total: l.amount + l.vat,
      memo: v.memo ?? "",
      vid: v.id,
    });
  }

  const wp = wb.addWorksheet("거래처");
  wp.columns = [
    { header: "거래처", key: "name", width: 24 },
    { header: "구분", key: "kind", width: 8 },
    { header: "단가등급", key: "grade", width: 8 },
    { header: "잔액(받을+/줄−)", key: "balance", width: 16 },
    { header: "사업자번호", key: "biz_no", width: 14 },
    { header: "대표자", key: "rep", width: 10 },
    { header: "전화", key: "tel", width: 14 },
    { header: "휴대폰", key: "mobile", width: 14 },
    { header: "이메일", key: "email", width: 22 },
    { header: "주소", key: "address", width: 36 },
    { header: "은행", key: "bank", width: 10 },
    { header: "계좌", key: "acct", width: 18 },
    { header: "예금주", key: "holder", width: 10 },
    { header: "메모", key: "memo", width: 24 },
  ];
  for (const p of partnersWithBalance(data)) {
    wp.addRow({
      name: p.name,
      kind: PARTNER_KIND_LABEL[p.kind],
      grade: p.price_grade,
      balance: p.balance,
      biz_no: p.biz_no,
      rep: p.rep_name,
      tel: p.tel,
      mobile: p.mobile,
      email: p.email,
      address: p.address,
      bank: p.bank,
      acct: p.bank_account,
      holder: p.bank_holder,
      memo: p.memo,
    });
  }

  const wi = wb.addWorksheet("품목");
  wi.columns = [
    { header: "품목", key: "name", width: 34 },
    { header: "규격", key: "spec", width: 14 },
    { header: "분류", key: "group", width: 12 },
    { header: "과세", key: "vat", width: 6 },
    { header: "매입가", key: "buy", width: 12 },
    { header: "판매가A", key: "sell", width: 12 },
    { header: "판매가B", key: "sell_b", width: 12 },
    { header: "판매가C", key: "sell_c", width: 12 },
    { header: "소비가", key: "consumer", width: 12 },
    { header: "재고관리", key: "track", width: 8 },
    { header: "적정재고", key: "min", width: 8 },
    { header: "현재고", key: "stock", width: 8 },
  ];
  for (const i of itemsWithStock(data)) {
    wi.addRow({
      name: i.name,
      spec: i.spec,
      group: i.group_name,
      vat: VAT_TYPE_LABEL[i.vat_type] ?? "",
      buy: i.purchase_price,
      sell: i.sale_price,
      sell_b: i.sale_price_b ?? "",
      sell_c: i.sale_price_c ?? "",
      consumer: i.consumer_price ?? "",
      track: i.track_stock ? "예" : "",
      min: i.min_stock ?? "",
      stock: i.stock ?? "",
    });
  }

  for (const sheet of [ws, wp, wi]) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.columns.forEach((c) => {
      if (["price", "amount", "vat", "total", "balance", "buy", "sell", "sell_b", "sell_c", "consumer"].includes(String(c.key))) c.numFmt = "#,##0";
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const name = encodeURIComponent(`장부백업_${todayKST()}.xlsx`);
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${name}`,
    },
  });
}
