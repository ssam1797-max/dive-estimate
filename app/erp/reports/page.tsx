import Link from "next/link";

const REPORTS = [
  { href: "/erp/reports/daily", title: "일계표 · 일보/월보", desc: "날짜별·월별 매출·매입·입금·출금 합계" },
  { href: "/erp/reports/sales", title: "판매현황", desc: "거래처별·품목별 판매(구매) 수량과 금액" },
  { href: "/erp/reports/balances", title: "미수/미지급현황", desc: "거래처별 받을 돈·줄 돈 한눈에" },
  { href: "/erp/reports/journal", title: "매출장 · 매입장", desc: "기간 안의 매출(매입) 전표 줄 전체" },
  { href: "/erp/reports/stock", title: "재고보고서", desc: "재고관리 품목의 입고·출고·현재고·재고금액" },
  { href: "/erp/reports/stock?low=1", title: "부족재고 리스트", desc: "현재고가 적정재고보다 적은 품목" },
  { href: "/erp/reports/item-ledger", title: "품목별 원장(수불)", desc: "한 품목의 입고·출고 내역과 재고 흐름" },
];

export default function ReportsHome() {
  return (
    <main className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">보고서</h1>
      <p className="text-sm text-muted-foreground">모든 보고서는 기간을 정해 조회하고, 인쇄·PDF 저장·공유할 수 있어요. 견적은 장부가 아니라서 들어가지 않아요.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="rounded-lg border p-4 transition-colors hover:bg-accent">
            <div className="font-semibold">{r.title}</div>
            <div className="mt-1 text-sm text-muted-foreground">{r.desc}</div>
          </Link>
        ))}
      </div>
    </main>
  );
}
