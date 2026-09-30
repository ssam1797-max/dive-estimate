/** 서버 시간대와 무관하게 이 앱을 쓰는 다이빙샵 기준(한국) 오늘 날짜를 얻는다. */
export function todayInSeoul(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}
