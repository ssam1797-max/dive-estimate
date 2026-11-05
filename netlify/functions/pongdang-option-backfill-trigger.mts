/**
 * 옵션 보완의 진입점. 매시 30분에 실행한다. 6시간마다 정시에 돌며 약 5분
 * 걸리는 전체 동기화와 겹치지 않는 시각이다. 예약 함수는 30초밖에 못 돌아서
 * 백그라운드 함수를 호출만 하고 끝난다(pongdang-sync-trigger.mts 와 같은 구조).
 * 남은 품목이 없으면 백그라운드 함수가 첫 호출에서 바로 끝난다.
 */
export const config = {
  schedule: "30 * * * *",
};

const handler = async () => {
  const siteUrl = process.env.URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl || !cronSecret) {
    console.error("[pongdang-option-backfill-trigger] URL 또는 CRON_SECRET 환경 변수가 없습니다.");
    return new Response("설정 누락", { status: 500 });
  }

  try {
    const response = await fetch(`${siteUrl}/.netlify/functions/pongdang-option-backfill-background`, {
      method: "POST",
      headers: { "x-cron-secret": cronSecret },
    });
    console.log(`[pongdang-option-backfill-trigger] 호출 상태: ${response.status}`);
  } catch (error) {
    console.error("[pongdang-option-backfill-trigger] 호출 실패:", error);
  }

  return new Response("triggered", { status: 202 });
};

export default handler;
