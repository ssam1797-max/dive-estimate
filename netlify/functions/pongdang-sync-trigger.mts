/**
 * 퐁당닷컴 자동 동기화의 진입점. 6시간마다(KST 05/11/17/23시, = UTC
 * 20/02/08/14시) 하루 4번 실행한다.
 *
 * Netlify 예약(Scheduled) 함수는 실행 시간이 30초로 짧아, 카테고리×페이지
 * 전체를 순회하는 실제 동기화 작업(usePongdangChunkedSync 와 동일한 로직,
 * pongdang-sync-background.mts 참고)을 직접 수행할 수 없다. 그래서 이
 * 함수는 같은 사이트의 백그라운드 함수(최대 15분)를 HTTP로 한 번
 * 호출(trigger)만 하고 바로 끝난다 — 두 트리거 타입(schedule/background)을
 * 함수 하나에 동시에 지정할 수 없기 때문에 분리된 두 함수로 구성했다.
 *
 * 원래 하루 1번(새벽 5시)이었다 — 상세페이지 옵션 보완(조각당
 * MAX_DETAIL_FETCHES_PER_CHUNK 건, pongdangCrawler.ts 참고)이 품절→재입고
 * 복귀를 색상 단위로 잡아내는 유일한 경로인데, 조각 1번의 처리량 자체를
 * 올리면 Netlify의 30초 무응답 제한에 걸리는 것을 실측으로 확인해(해당
 * 파일 주석 참고) 안전한 조각당 처리량은 그대로 두고, 대신 전체 동기화
 * 실행 횟수 자체를 늘려 하루 총 보완 처리량을 올렸다(각 실행은 약
 * 4~5분이라 6시간 간격에서 겹칠 위험이 없다, 2026-10-24).
 */
export const config = {
  schedule: "0 */6 * * *",
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
