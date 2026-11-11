"use client";

import * as React from "react";

/** A4 가로 폭(210mm)을 96dpi CSS px 로 환산한 값. */
const A4_WIDTH_PX = 794;

/**
 * A4 문서(견적서/거래명세서)를 좁은 화면에서도 종이 비율 그대로 보여주는 틀.
 *
 * 문서 표는 칸 폭이 전부 %라, 휴대폰(약 390px)처럼 좁은 화면에 그대로 넣으면
 * 칸마다 글자가 세로로 꺾이고 숫자가 잘려 읽을 수 없었다. 이 틀은 안쪽을
 * 항상 A4 폭(794px)으로 그린 뒤, 바깥 폭이 그보다 좁으면 CSS zoom 으로 통째로
 * 축소해 화면 폭에 딱 맞춘다(종이를 멀리서 보는 것과 같은 모습 — 두 손가락
 * 확대로 자세히 볼 수 있다). 화면이 A4 폭보다 넓으면 아무것도 하지 않는다.
 *
 * 인쇄(@media print)와 PDF 다운로드에는 축소가 적용되면 안 된다 — 인쇄는
 * globals.css 의 .a4-scale-inner 규칙이, PDF 는 exportElementToPdf 가
 * data-a4-scale 속성을 찾아 캡처용 복제본에서 축소를 풀어준다.
 */
export function A4ScaleFrame({ children }: { children: React.ReactNode }) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const [scale, setScale] = React.useState(1);

  React.useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const update = () => {
      const width = frame.clientWidth;
      setScale(width > 0 && width < A4_WIDTH_PX ? width / A4_WIDTH_PX : 1);
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="a4-scale-frame">
      <div
        data-a4-scale
        className="a4-scale-inner"
        style={scale < 1 ? { width: A4_WIDTH_PX, zoom: scale } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
