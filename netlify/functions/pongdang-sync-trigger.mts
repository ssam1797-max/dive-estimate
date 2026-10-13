/**
 * 매일 새벽 5시(KST, = UTC 20시) 퐁당닷컴 자동 동기화의 진입점.
 *
 * Netlify 예약(Scheduled) 함수는 실행 시간이 30초로 짧아, 카테고리×페이지
 * 전체를 순회하는 실제 동기화 작업(usePongdangChunkedSync 와 동일한 로직,
 * pongdang-sync-background.mts 참고)을 직접 수행할 수 없다. 그래서 이
 * 함수는 같은 사이트의 백그라운드 함수(최대 15분)를 HTTP로 한 번
 * 호출(trigger)만 하고 바로 끝난다 — 두 트리거 타입(schedule/background)을
 * 함수 하나에 동시에 지정할 수 없기 때문에 분리된 두 함수로 구성했다.
 */
export const config = {
  schedule: "0 20 * * *",
};

const handler = async () => {
  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl || !cronSecret) {
    console.error(
      "[pongdang-sync-trigger] URL 또는 CRON_SECRET 환경 변수가 설정되지 않았습니다. " +
        "Netlify Site configuration > Environment variables 를 확인하세요."
    );
    return new Response("설정 누락", { status: 500 });
  }

  try {
    const response = await fetch(`${siteUrl}/.netlify/functions/pongdang-sync-background`, {
      method: "POST",
      headers: { "x-cron-secret": cronSecret },
    });
    console.log(`[pongdang-sync-trigger] 백그라운드 동기화 호출 상태: ${response.status}`);
  } catch (error) {
    console.error("[pongdang-sync-trigger] 백그라운드 함수 호출 실패:", error);
  }

  return new Response("triggered", { status: 202 });
};

export default handler;
