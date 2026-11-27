const won = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const qtyFmt = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 4 });

export function formatWon(value: number | null | undefined): string {
  return won.format(Math.round(Number(value ?? 0)));
}

export function formatQty(value: number | null | undefined): string {
  return qtyFmt.format(Number(value ?? 0));
}

/** 서버(UTC)에서도 한국 날짜 기준으로 오늘을 YYYY-MM-DD 로 */
export function todayKST(): string {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

export function monthRange(date: string): { from: string; to: string } {
  const [y, m] = date.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, "0");
  return { from: `${y}-${mm}-01`, to: `${y}-${mm}-${String(last).padStart(2, "0")}` };
}

export function formatDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${y}.${m}.${d}`;
}
