/**
 * 클립보드에 텍스트를 복사한다.
 *
 * 텍스트 대신 Promise<string> 을 넘길 수 있다 — 보관함 목록의 복사 버튼처럼
 * "클릭 → 서버에서 견적서 상세 조회 → 복사" 흐름에서, iOS Safari 는 await
 * 이후의 writeText 를 "사용자 동작이 아님"으로 보고 막아버린다. 이때
 * ClipboardItem 에 Promise 를 그대로 넘기면 클릭 시점에 복사 권한을 확보한
 * 채로 데이터가 준비될 때까지 기다려 준다(Safari·Chrome 모두 지원).
 */
export async function copyTextToClipboard(source: string | Promise<string>): Promise<void> {
  const canUseClipboardItem =
    typeof window !== "undefined" &&
    typeof window.ClipboardItem !== "undefined" &&
    typeof navigator.clipboard?.write === "function";

  if (typeof source !== "string" && canUseClipboardItem) {
    const blobPromise = source.then((text) => new Blob([text], { type: "text/plain" }));
    try {
      await navigator.clipboard.write([new ClipboardItem({ "text/plain": blobPromise })]);
      return;
    } catch (error) {
      // 데이터 조회 자체가 실패한 경우엔 그 에러를 그대로 올려 보낸다.
      await source;
      // 조회는 성공했는데 ClipboardItem 방식만 실패했다면 아래 일반 경로로 재시도.
      void error;
    }
  }

  const text = await source;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // http 환경/권한 거부 등 — 아래 구형 방식으로 한 번 더 시도.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("copy command failed");
  } finally {
    document.body.removeChild(textarea);
  }
}
