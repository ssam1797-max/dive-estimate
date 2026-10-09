/**
 * 화면에 이미 렌더링된 DOM 요소를 그대로 캡처해 PDF로 저장한다. 서버에서
 * 헤드리스 브라우저로 새로 그리는 방식(Puppeteer 등) 대신 클라이언트에서
 * html2canvas + jsPDF 로 처리하므로, 이미 인쇄 화면에 보이는 것과 100%
 * 동일한 결과물이 나오고 서버리스 함수 크기/시간 제약도 받지 않는다.
 *
 * 내용이 A4 한 장(297mm)보다 길면 자동으로 여러 페이지로 잘라 담는다.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  fileName: string
): Promise<void> {
  // html2canvas(원본)는 Tailwind v4 기본 팔레트가 쓰는 최신 CSS 색상 함수
  // (lab()/oklch())를 파싱하지 못해 캡처가 그대로 실패한다 — 이를 지원하는
  // 유지보수 중인 포크(html2canvas-pro)를 대신 사용한다.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  // min-height:100vh(화면에서 보기 좋게 하려는 용도일 뿐)가 캡처에 그대로
  // 섞이면 실제 내용보다 훨씬 긴 빈 여백이 PDF에 통째로 들어간다 — 캡처
  // 직전에만 잠시 풀어준다(인라인 스타일이 클래스보다 우선하므로 이걸로
  // 충분하고, 끝나면 원래대로 되돌려 화면 표시에는 영향이 없다).
  const previousMinHeight = element.style.minHeight;
  element.style.minHeight = "auto";

  // 관리자 전용 단가/금액 인라인 입력란(<input>) 은 html2canvas 계열 라이브러리가
  // 안정적으로 그려주지 못한다 — <input> 은 브라우저가 폼 컨트롤로 별도
  // 렌더링하는 요소라, DOM을 그대로 읽어 캔버스에 그리는 html2canvas는 React가
  // DOM 프로퍼티로만 반영한 현재 입력값을 못 읽고 빈 칸으로 캡처하는 경우가
  // 있다("PDF 다운로드하면 단가/금액이 안 보인다"는 증상의 원인). 캡처 직전
  // 에만 각 입력란을 같은 스타일의 일반 텍스트(span)로 바꿔치기해 일반
  // 텍스트처럼 확실하게 캡처되게 하고, 끝나면 원래 입력란으로 되돌린다.
  const inputs = Array.from(element.querySelectorAll("input"));
  const restoreInputs = inputs.map((input) => {
    const span = document.createElement("span");
    span.textContent = input.value;
    span.className = input.className;
    span.setAttribute("style", input.getAttribute("style") ?? "");
    input.replaceWith(span);
    return () => span.replaceWith(input);
  });

  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
    });
  } finally {
    element.style.minHeight = previousMinHeight;
    restoreInputs.forEach((restore) => restore());
  }

  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;

  const imgWidthMm = A4_WIDTH_MM;
  const imgHeightMm = (canvas.height / canvas.width) * imgWidthMm;

  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  // PNG 로 그대로 넣으면 텍스트 안티앨리어싱 때문에 색상 수가 많아져 파일이
  // 한 장짜리 문서인데도 수 MB까지 불어난다(이메일 첨부/모바일에 부담) —
  // 표/텍스트 위주 문서에는 티가 거의 안 나는 수준으로 JPEG 압축한다.
  if (imgHeightMm <= A4_HEIGHT_MM) {
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, imgWidthMm, imgHeightMm);
  } else {
    // 캔버스를 A4 한 장 분량의 픽셀 높이씩 잘라 페이지를 늘려간다.
    const pageHeightPx = Math.floor((A4_HEIGHT_MM / imgHeightMm) * canvas.height);
    let renderedPx = 0;
    let isFirstPage = true;

    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(
        canvas,
        0,
        renderedPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx
      );

      const sliceHeightMm = (sliceHeightPx / canvas.width) * imgWidthMm;
      if (!isFirstPage) pdf.addPage();
      pdf.addImage(
        sliceCanvas.toDataURL("image/jpeg", 0.92),
        "JPEG",
        0,
        0,
        imgWidthMm,
        sliceHeightMm
      );

      renderedPx += sliceHeightPx;
      isFirstPage = false;
    }
  }

  pdf.save(fileName);
}
