import type { ProfileOption } from "@/lib/estimates/types";
import { formatDiscountRate } from "@/lib/estimates/pricing";

/**
 * 실제 견적서 문서(미리보기 다이얼로그·인쇄 화면·다운로드되는 .xlsx)가 전부
 * 똑같은 모양을 그리도록 공통으로 쓰는 순수 표시용 컴포넌트. 훅/이벤트가 없어
 * 서버 컴포넌트에서도 그대로 쓸 수 있다("use client" 불필요).
 *
 * 가격(unitPrice/amount/vat)은 이미 계산이 끝난 값을 그대로 받는다 — 이 컴포넌트는
 * 재계산을 전혀 하지 않는다(호출부마다 계산 기준이 다르므로: 미리보기는 가격
 * 탭+브랜드 정책으로 즉시 계산, 보관함 인쇄는 저장 시점에 확정된 단가를 그대로 사용).
 */
export interface EstimateDocumentRow {
  seq: number;
  /** React key 용. 클라이언트에서는 clientId, 서버 조회에서는 index 등을 넘기면 된다. */
  key: string | number;
  name: string;
  spec: string;
  unit: string;
  quantity: number;
  /** "기준 등급" 기준 실제 단가 — 총 합계금액(실제 결제 금액) 계산에 쓰이는 유일한 값. */
  unitPrice: number;
  amount: number;
  vat: number;
  itemRemarks: string;
  /** 소비자가격 대비 할인율(%). 계산 기준(priceRetail)이 없는 호출부(보관함 인쇄 등)는 생략 가능 — 생략 시 표시 안 함. */
  discountRate?: number;
  /**
   * 참고용으로 함께 노출할 등급들의 단가 목록. 테이블 props 의
   * `referenceTierLabels` 와 같은 순서/길이여야 한다(길이가 다르면 부족한
   * 자리는 "-" 로 채운다). 단순 참고 표시일 뿐 — 총 합계금액 계산에는
   * 전혀 관여하지 않는다.
   */
  referenceValues?: number[];
}

interface EstimateDocumentTableProps {
  estimateNumber: string;
  date: string;
  provider: ProfileOption | null;
  receiver: ProfileOption | null;
  remarks: string;
  rows: EstimateDocumentRow[];
  /** 체크된 참고 가격 등급들의 표시 이름(선택된 순서 그대로). 없으면 원본 13열 그대로. */
  referenceTierLabels?: string[];
}

// ₩ 기호 없이 콤마만 (원본 견적서에 통화 기호가 전혀 없다)
function fmtWon(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

function fmtNum(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

const DAY_OF_WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];

function formatDisplayDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  const display = date.replace(/-/g, ".");
  if (!date || Number.isNaN(parsed.getTime())) return display || "-";
  return `${display}(${DAY_OF_WEEK_KO[parsed.getDay()]})`;
}

// 원본 12열 비율(부가세 열 삭제 후, 실제 견적서 스크린샷을 픽셀 단위로 측정해서
// 맞춘 값, Excel COL_WIDTHS_BASE 와 동일 — buildEstimateWorkbook.ts 참고).
// "수량"과 "단가" 사이에 체크된 참고 등급 수(N)만큼 열을 끼워 넣어
// 12+N 열로 동적으로 늘어난다 — N=0이면 원본 12열 그대로다.
//
// 가격류 열(참고 등급 N개 · 단가 · 금액)은 전부 같은 종류의 금액이라 폭이
// 서로 달라야 할 이유가 없는데, 예전에는 참고 등급 7.0 / 단가 9.8 / 금액
// 11.8 로 제각각이라 같은 자릿수 금액인데도 어떤 칸은 여유롭고 어떤 칸은
// 숫자가 테두리를 넘거나 잘렸다. 전부 PRICE_COL_WIDTH 하나로 통일한다.
// (단가·금액은 colSpan=2 라 슬롯 하나가 절반씩 나눠 갖는다.)
//
// 값(11.5)의 근거: A4 인쇄 가능 폭(210mm - 좌우 10mm = 190mm ≈ 718px) 기준
// 참고 등급을 하나도 안 켰을 때 11.5/93.9 ≈ 12.2% ≈ 88px 가 된다. 10px
// 폰트에서 천만 원 단위("10,000,000" = 8자리 + 콤마 2개)가 약 49px,
// 좌우 패딩(4px×2)까지 더해도 57px 이라 충분한 여유가 있다.
const PRICE_COL_WIDTH = 11.5;
const PRICE_SLOT = PRICE_COL_WIDTH / 2;
// 품명 ↔ 규격 폭 재배분(합계 41.5 는 그대로 유지 — 가격 열 폭에 영향 없음):
// 원본 스크린샷 비율은 품명 13.5 / 규격 28 로 규격이 품명의 2배였는데, 실제
// 이 앱의 데이터에서는 규격이 대개 "-" 나 "블랙 / L" 처럼 짧고 품명이
// ("포스엘리먼트 락호퍼 숏부츠, ROCK HOPPER 3MM SHOE") 훨씬 길다. 그 결과
// 품명이 3~5줄로 꺾여 행 하나가 28px 대신 60~90px 이 되고, 12품목 견적서가
// A4 한 장(1047px)을 넘겨 1371px 짜리 2페이지로 인쇄됐다. 품명을 넓히고
// 규격을 좁혀 줄바꿈을 줄인다.
const COL_WIDTHS_BASE = [
  6.6, // No.
  13, 13, // 품명 (colSpan 2)
  7.75, 7.75, // 규격 (colSpan 2)
  7.1, // 단위
  5, // 수량
  PRICE_SLOT, PRICE_SLOT, // 단가 (colSpan 2)
  PRICE_SLOT, PRICE_SLOT, // 금액 (colSpan 2)
  10.7, // 적요
];
const REFERENCE_COL_WIDTH = PRICE_COL_WIDTH;

// A4(297mm) 세로, body margin 10mm×2 를 뺀 실제 인쇄 가능 높이(277mm ≈ 1047px,
// 96 CSS px/in 기준)를 채우도록 실측(브라우저에서 렌더링된 각 행의 실제 높이를
// 측정) 기반으로 정한 값이다. 품목 수가 적어도 서식 전체가 A4 한 장을 거의
// 꽉 채우도록 하기 위함 — 이전 값(13)은 절반 정도만 채워 하단이 허전했다.
// 31 -> 29 -> 19 로 줄어든 이유: 처음엔 대표자 성명 폰트 확대(15px, bold)와
// 이메일 셀 줄바꿈(2줄) 등으로 늘어난 높이를 맞추려 29로 줄였고, 이후
// 표 전체 세로 길이를 더 줄이면서 대신 행 하나당 위아래 패딩(ITEM_ROW_PADDING_Y)
// 을 넓혀 답답해 보이지 않게 하자는 요청에 따라 19로 한 번 더 줄였다 —
// 행이 줄어든 만큼 한 행이 넓어져도(20px -> 28px, 아래 ITEM_ROW_HEIGHT)
// 총 높이(19×28≈532px)는 이전(29×20=580px)보다 오히려 더 짧다.
const MIN_DATA_ROWS = 19;

// 품목 표 각 행의 위아래 패딩(px)과, 그 패딩을 감안한 행 높이(빈 행 포함
// 전부 동일하게 맞춰야 표 전체 격자선이 가지런히 보인다). 상단 정보
// 블록(공급자 정보 등)은 이 상수와 무관하게 기존 높이를 그대로 유지한다.
const ITEM_ROW_PADDING_Y = "py-2"; // Tailwind py-2 = 8px(위아래 각각)
const ITEM_ROW_HEIGHT = 28;

// 원본은 배경색 채우기가 전혀 없고(전부 흰 배경), 테두리 색상만 구역별로 다르다.
const BLACK_BORDER = "border border-black";
const PURPLE_BORDER = "border" as const;
const purpleStyle = { borderColor: "#666695" };
const grayStyle = { borderColor: "#D4D4D4" };
const greenStyle = { borderColor: "#3A714A" };

// 숫자/코드성 컬럼(No·단위·수량·가격류)은 좁아져도 줄바꿈되어 꺾이면 안 되므로
// 항상 한 줄 고정(whitespace-nowrap). 반대로 품명/규격/적요처럼 길이가 일정치
// 않은 텍스트 컬럼은 남는 폭을 채우다 넘치면 자연스럽게 줄바꿈되어야 하므로
// break-keep(단어 중간에서 안 끊김) + break-words(그래도 안 끊기면 강제 줄바꿈)
// 조합을 쓴다 — 참고 등급 체크박스가 늘어나 컬럼이 좁아질수록 이 차이가 커진다.
const cellBase = "bg-white text-gray-900 text-[10px] px-1 leading-tight";
// 품목 표 데이터 셀만 위아래 패딩을 넓힌다(ITEM_ROW_PADDING_Y) — 상단 정보
// 블록에 쓰는 noBorderCell 은 원래 cellBase 그대로라 영향받지 않는다.
const itemCellBase = `${cellBase} ${ITEM_ROW_PADDING_Y}`;
const cellNumeric = `${itemCellBase} whitespace-nowrap`;
const cellText = `${itemCellBase} break-keep break-words`;
const noBorderCell = `${cellBase} border-0`;

// 가격류 데이터 셀(참고 등급 · 단가 · 금액) 공통 스타일 — 우측 정렬 +
// 좌우 4px 패딩(px-1, cellBase 에 포함)으로 숫자가 테두리선에 바짝 붙지
// 않게 하고, 8자리 금액("10,000,000")도 절대 꺾이지 않도록 한 줄
// 고정(whitespace-nowrap)한다. 모든 가격 열이 같은 폭이라 참고 등급을 몇
// 개 켜든 이 하나의 스타일만 쓰면 된다(예전에는 열이 좁아질 때를 대비해
// 인쇄 전용 축소 클래스를 따로 뒀는데, 폰트 크기가 본문과 같은 10px 이라
// 실제로는 아무 효과가 없는 무의미한 분기였다).
// 위아래 패딩만 py-2(8px) 대신 py-1(4px)로 좁힌다 — 할인율 배지가 붙어
// 두 줄이 되는 셀도 기본 행 높이(ITEM_ROW_HEIGHT=28px) 안에 들어가게
// 하려면 4+4(패딩) + 12.5(10px 본문 × leading-tight) + 8(8px 배지 ×
// leading-none) ≈ 28.5px 로 맞춰야 한다. py-2 였을 때는 36.5px 이 되어
// 할인이 있는 행만 8px 씩 높아지며 표 전체가 그만큼 길어졌다.
// (itemCellBase 를 쓰지 않고 cellBase 에서 직접 조립하는 이유: Tailwind 는
// py-2 와 py-1 의 우선순위가 같아 클래스 문자열 순서로는 승부가 안 갈린다.)
const cellPrice = `${cellBase} py-1 whitespace-nowrap text-right`;

// 단가/금액 아래에 붙는 할인율 보조 줄(예: "39%↓"). 이 줄 때문에 할인이
// 있는 행만 다른 행보다 높아져 표 격자가 어긋나고 표 전체가 길어졌으므로,
// 차지하는 세로 공간을 최소로 깎는다 — leading-none(=1, 8px 글자면 딱 8px)
// + 위아래 여백 0. nowrap 은 "39%↓" 가 좁은 칸에서 두 줄로 꺾이는 것을 막는다.
const discountBadge = "text-[8px] leading-none text-gray-500 whitespace-nowrap";

/** 공급자에 등록된 도장 이미지가 없을 때 대신 보여줄 기본(MOCK) 도장. */
const MOCK_STAMP_SRC = "/mock-stamp.png";

export function EstimateDocumentTable({
  estimateNumber,
  date,
  provider,
  receiver,
  remarks,
  rows,
  referenceTierLabels = [],
}: EstimateDocumentTableProps) {
  const refCount = referenceTierLabels.length;

  // 가격류 열은 전부 같은 폭(PRICE_COL_WIDTH)이라 더 이상 열 개수에 따라
  // 폰트를 줄이지 않는다 — 대신 참고 등급을 켤수록 가격 열이 (N+2)개로
  // 늘어 전체에서 차지하는 비중이 커지므로, 그만큼 상대적으로 여유로운
  // 품명(인덱스 1,2)·규격(인덱스 3,4) 폭을 줄여 가격 열의 실제 폭(%)이
  // 8자리 금액을 못 담을 만큼 좁아지는 것을 막는다. (합계가 어떻게 바뀌든
  // 아래에서 totalW 기준으로 다시 정규화되므로 비율만 맞으면 항상 100%를
  // 채운다.)
  //
  // 이 배분으로 계산되는 가격 열 1칸의 실제 폭(A4 인쇄 718px 기준):
  //   N=0 → 12.2%(88px)   N=2 → 10.9%(78px)   N=4 → 9.4%(67px)
  // 전부 "10,000,000" 에 필요한 57px 보다 넉넉하다.
  const NAME_SPEC_INDEXES = [1, 2, 3, 4];
  const nameSpecScale = refCount >= 4 ? 0.58 : refCount >= 2 ? 0.72 : 1;
  const scaledBase = COL_WIDTHS_BASE.map((w, i) =>
    NAME_SPEC_INDEXES.includes(i) ? w * nameSpecScale : w
  );

  // 참고 등급 열을 "수량"과 "단가" 사이(base 배열의 인덱스 7)에 끼워 넣는다.
  const colWidths = [
    ...scaledBase.slice(0, 7),
    ...Array.from({ length: refCount }, () => REFERENCE_COL_WIDTH),
    ...scaledBase.slice(7),
  ];
  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const totalCols = colWidths.length; // 12 + refCount

  // 부가세 포함가 정책: row.amount(단가×수량)는 이미 부가세가 포함된 최종
  // 판매 금액이다. 부가세 금액/공급가액 역산 표기는 오히려 헷갈린다는
  // 피드백에 따라 화면에는 더 이상 부가세 관련 숫자를 표시하지 않는다
  // (row.vat 자체는 호출부가 여전히 계산해서 넘기지만 이 컴포넌트가
  // 렌더링하지 않을 뿐이다) — "공급금액"도 그냥 합계금액과 같은 값을 보여준다.
  // 참고 등급 열이 몇 개가 추가되든, 실제 결제 금액(총 합계금액)은 항상
  // row.amount(기준 등급 단가 × 수량)의 합 단 하나로만 계산한다.
  const grandTotal = rows.reduce((s, r) => s + r.amount, 0);
  const totalSupply = grandTotal;
  const totalQty = rows.reduce((s, r) => s + r.quantity, 0);
  const totalDataRows = Math.max(MIN_DATA_ROWS, rows.length);

  const stampSrc = provider?.stampUrl?.trim() || MOCK_STAMP_SRC;

  const colgroup = (
    <colgroup>
      {colWidths.map((w, i) => (
        <col key={i} style={{ width: `${(w / totalW) * 100}%` }} />
      ))}
    </colgroup>
  );

  return (
    <>
      {/* 상단 정보 블록(제목/발행일/공급자·공급받는자) — 페이지가 넘어가도
          반복되지 않는 부분이라 별도 표로 분리한다. 아래 품목 표와 컬럼 폭이
          동일한 <colgroup> 을 쓰기 때문에 이어 붙여도 하나의 표처럼 보인다. */}
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        {colgroup}
        <tbody>
        {/* ── 제목 (위 초록 테두리) ──────────────────────────────────── */}
        <tr style={{ height: 50 }}>
          <td
            colSpan={totalCols}
            className="border-0 border-t-2 bg-white text-center font-bold text-2xl text-gray-900 py-2"
            style={greenStyle}
          >
            견&nbsp;&nbsp;&nbsp;&nbsp;적&nbsp;&nbsp;&nbsp;&nbsp;서
          </td>
        </tr>

        {/* ── 발행일자(요일)/No. (아래 초록 굵은 테두리) ─────────────── */}
        <tr style={{ height: 22 }}>
          <td
            colSpan={totalCols}
            className="border-0 border-b-2 bg-white text-[11px] text-gray-900 text-right px-1"
            style={greenStyle}
          >
            {formatDisplayDate(date)}&nbsp;&nbsp;&nbsp;No.{estimateNumber || "-"}
          </td>
        </tr>

        {/* ── Row A: 귀하 / 공급자(세로 병합) / 사업번호 ─────────────── */}
        <tr style={{ height: 30 }}>
          <td colSpan={5} className={`${noBorderCell} font-bold text-[13px] underline`}>
            {receiver?.name ?? "-"}&nbsp;&nbsp;&nbsp;귀하
          </td>
          <td
            rowSpan={5}
            className={`${PURPLE_BORDER} bg-white text-center text-[11px] font-bold`}
            style={purpleStyle}
          >
            공급자
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            사업번호
          </td>
          <td
            colSpan={5 + refCount}
            className={`${PURPLE_BORDER} bg-white text-center text-[13px] font-bold`}
            style={purpleStyle}
          >
            {provider?.businessNumber ?? "-"}
          </td>
        </tr>

        {/* ── Row B: 공급금액 / 상호+대표자(도장) ─────────────────────── */}
        {/* 도장은 이제 td 기준 position:absolute(out-of-flow) 라 이 행 자체의
            높이에 영향을 주지 않는다(overflow-visible 이라 42px 도장이 이
            행보다 커도 위아래로 살짝 삐져나올 뿐, 잘리거나 다른 행을
            밀어내지 않는다) — A4 한 장에 여유를 주기 위해 34px 로 낮췄다
            (이전 42px 는 도장이 아직 행 안에 들어있던 구조를 위한 값이라
            지금은 더 클 필요가 없다). */}
        <tr style={{ height: 34 }}>
          <td colSpan={2} className={`${PURPLE_BORDER} bg-white text-left text-[10px] px-1.5`} style={grayStyle}>
            공급금액
          </td>
          <td colSpan={3} className={`${PURPLE_BORDER} bg-white text-right text-[12px] px-1.5 whitespace-nowrap`} style={grayStyle}>
            {fmtWon(totalSupply)} 원
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            상호
          </td>
          <td
            colSpan={3 + refCount}
            className={`${PURPLE_BORDER} bg-white text-center text-[10px]`}
            style={purpleStyle}
          >
            {provider?.name ?? "-"}
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            대표자
          </td>
          <td
            className={`${PURPLE_BORDER} relative overflow-visible bg-white text-center`}
            style={purpleStyle}
          >
            {/* 도장의 위치 기준을 이름 텍스트가 아니라 셀(td) 자체로 고정한다
                (position:relative 를 td 에 직접 둠) — 이름 길이·정렬과
                완전히 무관하게 항상 셀 우측 테두리선에 살짝 걸치는 고정된
                자리에 찍힌다. 이름은 가독성을 위해 크게(15px, bold) +
                자간을 넉넉히 띄워("이 춘 형") 표기한다. */}
            <span
              className="relative z-0 inline-block"
              style={{ fontSize: 15, fontWeight: "bold", letterSpacing: 2 }}
            >
              {(provider?.representative ?? "-").split("").join(" ")}
            </span>
            {provider && (
              <img
                src={stampSrc}
                alt="도장"
                // maxWidth:none — Tailwind 기본 리셋(img{max-width:100%})이
                // width:42px 지정을 셀 폭 기준 100%로 다시 제한하는 것을
                // 막는다(이번엔 셀이 42px보다 넓어 실질적 영향은 없지만,
                // 다른 화면 크기에서도 항상 42px을 보장하기 위해 유지).
                className="pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 overflow-visible mix-blend-multiply"
                style={{ right: -10, width: 42, height: 42, maxWidth: "none" }}
              />
            )}
          </td>
        </tr>

        {/* ── Row C: 부가세 / 주소 ─────────────────────────────────────── */}
        <tr style={{ height: 30 }}>
          <td colSpan={2} className={`${PURPLE_BORDER} bg-white text-left text-[10px] px-1.5`} style={grayStyle}>
            부가세
          </td>
          <td colSpan={3} className={`${PURPLE_BORDER} bg-white text-right text-[12px] px-1.5 whitespace-nowrap`} style={grayStyle}>
            &nbsp;
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            주소
          </td>
          <td
            colSpan={5 + refCount}
            className={`${PURPLE_BORDER} bg-white text-center text-[10px]`}
            style={purpleStyle}
          >
            {provider?.address ?? "-"}
          </td>
        </tr>

        {/* ── Row D: 합계금액 / 업태+종목 ──────────────────────────────── */}
        <tr style={{ height: 30 }}>
          <td colSpan={2} className={`${PURPLE_BORDER} bg-white text-left text-[10px] font-bold px-1.5`} style={grayStyle}>
            합계금액
          </td>
          <td colSpan={3} className={`${PURPLE_BORDER} bg-white text-right text-[13px] font-bold px-1.5 whitespace-nowrap`} style={grayStyle}>
            {fmtWon(grandTotal)} 원
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            업태
          </td>
          <td
            colSpan={3 + refCount}
            className={`${PURPLE_BORDER} bg-white text-center text-[10px]`}
            style={purpleStyle}
          >
            {provider?.businessType ?? "-"}
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            종목
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            {provider?.businessCategory ?? "-"}
          </td>
        </tr>

        {/* ── Row E: 안내문구 / 전화+이메일 ───────────────────────────── */}
        <tr style={{ height: 30 }}>
          <td colSpan={5} className={`${noBorderCell} text-[10px] align-bottom`}>
            아래와 같이 견적 합니다.
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            전화
          </td>
          <td
            colSpan={3 + refCount}
            className={`${PURPLE_BORDER} bg-white text-center text-[10px]`}
            style={purpleStyle}
          >
            {provider?.contact ?? "-"}
          </td>
          <td className={`${PURPLE_BORDER} bg-white text-center text-[10px]`} style={purpleStyle}>
            이메일
          </td>
          {/* 11px 로도 셀 폭을 절대 넘지 않는 이유: break-all 은 글자 폭과
              무관하게 셀 경계에서 무조건 줄바꿈하므로(말줄임과 달리 이메일
              주소 전체가 보존된다), 가로 넘침 자체가 CSS 상 원천 차단된다 —
              세로로만 두 줄이 될 뿐이다. */}
          <td
            className={`${PURPLE_BORDER} bg-white text-center leading-tight break-all text-blue-700 underline`}
            style={{ ...purpleStyle, fontSize: 11 }}
          >
            {provider?.email ?? "-"}
          </td>
        </tr>

        {/* ── 공백 ──────────────────────────────────────────────────── */}
        <tr style={{ height: 8 }}>
          <td colSpan={totalCols} className="border-0 bg-white" />
        </tr>
        </tbody>
      </table>

      {/* 품목 표 — 컬럼 헤더를 실제 <thead> 로 둬서, 품목이 많아 인쇄 시
          페이지가 넘어가도 브라우저가 다음 페이지 상단에 헤더를 자동으로
          반복해서 그려준다(위 정보 블록은 반복되면 안 되므로 별도 표로 분리). */}
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        {colgroup}
        <thead>
        {/* ── 테이블 헤더 (배경색 없음, 굵은 위 테두리) ────────────────── */}
        <tr style={{ height: 30 }}>
          <td className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            No.
          </td>
          <td colSpan={2} className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            품&nbsp;&nbsp;&nbsp;&nbsp;명
          </td>
          <td colSpan={2} className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            규&nbsp;&nbsp;&nbsp;&nbsp;격
          </td>
          <td className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            단위
          </td>
          <td className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            수량
          </td>
          {referenceTierLabels.map((label, i) => (
            <td
              key={`ref-head-${i}`}
              className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[9px] leading-tight`}
            >
              {label}
            </td>
          ))}
          <td colSpan={2} className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            단&nbsp;&nbsp;&nbsp;&nbsp;가
            <div className="text-[8px] font-normal leading-tight">(부가세포함)</div>
          </td>
          <td colSpan={2} className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            금&nbsp;&nbsp;&nbsp;&nbsp;액
          </td>
          <td className={`${BLACK_BORDER} border-t-2 bg-white font-bold text-center text-[11px] whitespace-nowrap`}>
            적&nbsp;&nbsp;요
          </td>
        </tr>
        </thead>
        <tbody>
        {/* ── 데이터 행 ─────────────────────────────────────────────── */}
        {rows.map((row) => (
          <tr key={row.key} style={{ height: ITEM_ROW_HEIGHT }}>
            <td className={`${BLACK_BORDER} ${cellNumeric} text-center`}>{row.seq}</td>
            <td colSpan={2} className={`${BLACK_BORDER} ${cellText} text-left`}>
              {row.name}
            </td>
            <td colSpan={2} className={`${BLACK_BORDER} ${cellText} text-center`}>
              {row.spec}
            </td>
            <td className={`${BLACK_BORDER} ${cellNumeric} text-center`}>{row.unit}</td>
            <td className={`${BLACK_BORDER} ${cellNumeric} text-center`}>{row.quantity}</td>
            {Array.from({ length: refCount }, (_, i) => row.referenceValues?.[i]).map(
              (value, i) => (
                <td key={`ref-${i}`} className={`${BLACK_BORDER} ${cellPrice}`}>
                  {value != null ? fmtNum(value) : "-"}
                </td>
              )
            )}
            {/* 단가/금액은 colSpan=2 짜리 하나의 셀에 숫자를 그대로 두고, 할인율은
                그 아래 작은 보조 줄로만 덧붙인다 — 숫자 셀을 둘로 쪼개
                (번호 칸 + 배지 칸) 각각 반쪽 폭만 쓰게 하면, 할인이 없어
                배지가 비어 있을 때도 숫자 칸 자체가 원래 폭의 절반으로
                좁아져 큰 금액이 잘리거나 안 보이는 문제가 생긴다. */}
            <td colSpan={2} className={`${BLACK_BORDER} ${cellPrice}`}>
              {fmtNum(row.unitPrice)}
              {!!row.discountRate && row.discountRate > 0 && (
                <div className={discountBadge}>
                  {formatDiscountRate(row.discountRate)}%↓
                </div>
              )}
            </td>
            <td colSpan={2} className={`${BLACK_BORDER} ${cellPrice}`}>
              {fmtNum(row.amount)}
              {!!row.discountRate && row.discountRate > 0 && (
                <div className={discountBadge}>
                  -{formatDiscountRate(row.discountRate)}%
                </div>
              )}
            </td>
            <td className={`${BLACK_BORDER} ${cellText} text-center`}>
              {row.itemRemarks || "-"}
            </td>
          </tr>
        ))}

        {/* ── 이하여백 + 빈 행 ──────────────────────────────────────── */}
        {rows.length < totalDataRows && (
          <>
            <tr style={{ height: ITEM_ROW_HEIGHT }}>
              <td
                colSpan={totalCols}
                className={`${BLACK_BORDER} ${ITEM_ROW_PADDING_Y} bg-white text-[10px] text-center text-gray-500`}
              >
                ~ 이 하 여 백 ~
              </td>
            </tr>
            {Array.from({
              length: totalDataRows - rows.length - 1,
            }).map((_, i) => (
              <tr key={`empty-${i}`} style={{ height: ITEM_ROW_HEIGHT }}>
                {Array.from({ length: totalCols }).map((_, c) => (
                  <td key={c} className={`${BLACK_BORDER} bg-white`} />
                ))}
              </tr>
            ))}
          </>
        )}

        {/* ── 총 계 (흰 배경, 강조색 없음) ──────────────────────────── */}
        <tr style={{ height: 24 }}>
          <td colSpan={6} className={`${BLACK_BORDER} bg-white text-[11px] text-center font-bold whitespace-nowrap`}>
            총&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;계
          </td>
          <td className={`${BLACK_BORDER} bg-white text-[10px] text-center font-bold whitespace-nowrap`}>
            {totalQty}
          </td>
          {refCount > 0 && (
            <td colSpan={refCount} className={`${BLACK_BORDER} bg-white`} />
          )}
          <td colSpan={2} className={`${BLACK_BORDER} bg-white`} />
          <td colSpan={2} className={`${BLACK_BORDER} bg-white text-[10px] text-right font-bold px-1 whitespace-nowrap`}>
            {fmtNum(grandTotal)}
          </td>
          <td className={`${BLACK_BORDER} bg-white`} />
        </tr>

        {/* ── 비고 (좌: 세로 병합 라벨, 우: 내용) ──────────────────────── */}
        <tr style={{ height: 20 }}>
          <td rowSpan={5} className={`${BLACK_BORDER} bg-white text-center text-[10px] align-middle whitespace-nowrap`}>
            비고
          </td>
          <td
            colSpan={11 + refCount}
            rowSpan={5}
            className={`${BLACK_BORDER} bg-white text-[10px] text-gray-900 px-2 py-1 align-top whitespace-pre-wrap`}
          >
            {remarks || "해당사항 없음"}
          </td>
        </tr>
        {/* 위 "비고" 셀들이 rowSpan=5 이므로, 나머지 4행은 셀 없이 높이만 차지한다. */}
        <tr style={{ height: 20 }} />
        <tr style={{ height: 20 }} />
        <tr style={{ height: 20 }} />
        <tr style={{ height: 20 }} />
        </tbody>
      </table>
    </>
  );
}
