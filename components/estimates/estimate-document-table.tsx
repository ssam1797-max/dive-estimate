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
// "수량"과 "단가" 사이에 체크된 참고 등급 수(N)만큼 열(각 7.0)을 끼워 넣어
// 12+N 열로 동적으로 늘어난다 — N=0이면 원본 12열 그대로다.
const COL_WIDTHS_BASE = [6.6, 6.75, 6.75, 14, 14, 7.1, 5, 4.9, 4.9, 5.9, 5.9, 10.7];
const REFERENCE_COL_WIDTH = 7.0;

// A4(297mm) 세로, body margin 10mm×2 를 뺀 실제 인쇄 가능 높이(277mm ≈ 1047px,
// 96 CSS px/in 기준)를 채우도록 실측(브라우저에서 렌더링된 각 행의 실제 높이를
// 측정) 기반으로 정한 값이다. 품목 수가 적어도 서식 전체가 A4 한 장을 거의
// 꽉 채우도록 하기 위함 — 이전 값(13)은 절반 정도만 채워 하단이 허전했다.
// 31이었다가 29로 2줄 줄인 이유: 이후 대표자 성명 폰트 확대(15px, bold)와
// 이메일 셀 줄바꿈(2줄) 등으로 총 높이가 조금씩 늘어, 품목이 5개만 있어도
// 277mm 를 살짝 넘겨 헤더만 있는 빈 2페이지가 따라 나오는 문제가 있었다.
const MIN_DATA_ROWS = 29;

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
const cellNumeric = `${cellBase} whitespace-nowrap`;
const cellText = `${cellBase} break-keep break-words`;
const noBorderCell = `${cellBase} border-0`;

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

  // 참고 등급 열(폭 7.0 × N)을 "수량"과 "단가" 사이(base 배열의 인덱스 7)에 끼워 넣는다.
  const colWidths = [
    ...COL_WIDTHS_BASE.slice(0, 7),
    ...Array.from({ length: refCount }, () => REFERENCE_COL_WIDTH),
    ...COL_WIDTHS_BASE.slice(7),
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
          <td colSpan={3} className={`${PURPLE_BORDER} bg-white text-left text-[10px] px-1.5`} style={grayStyle}>
            공급금액
          </td>
          <td colSpan={2} className={`${PURPLE_BORDER} bg-white text-right text-[12px] px-1.5`} style={grayStyle}>
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
          <td colSpan={3} className={`${PURPLE_BORDER} bg-white text-left text-[10px] px-1.5`} style={grayStyle}>
            부가세
          </td>
          <td colSpan={2} className={`${PURPLE_BORDER} bg-white text-right text-[12px] px-1.5`} style={grayStyle}>
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
          <td colSpan={3} className={`${PURPLE_BORDER} bg-white text-left text-[10px] font-bold px-1.5`} style={grayStyle}>
            합계금액
          </td>
          <td colSpan={2} className={`${PURPLE_BORDER} bg-white text-right text-[13px] font-bold px-1.5`} style={grayStyle}>
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
          <tr key={row.key} style={{ height: 20 }}>
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
                <td key={`ref-${i}`} className={`${BLACK_BORDER} ${cellNumeric} text-right`}>
                  {value != null ? fmtNum(value) : "-"}
                </td>
              )
            )}
            <td colSpan={2} className={`${BLACK_BORDER} ${cellNumeric} text-right`}>
              {fmtNum(row.unitPrice)}
              {!!row.discountRate && row.discountRate > 0 && (
                <div className="text-[8px] leading-tight text-gray-500">
                  {formatDiscountRate(row.discountRate)}%↓
                </div>
              )}
            </td>
            <td colSpan={2} className={`${BLACK_BORDER} ${cellNumeric} text-right`}>
              {fmtNum(row.amount)}
              {!!row.discountRate && row.discountRate > 0 && (
                <div className="text-[8px] leading-tight text-gray-500">
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
            <tr style={{ height: 20 }}>
              <td
                colSpan={totalCols}
                className={`${BLACK_BORDER} bg-white text-[10px] text-center text-gray-500`}
              >
                ~ 이 하 여 백 ~
              </td>
            </tr>
            {Array.from({
              length: totalDataRows - rows.length - 1,
            }).map((_, i) => (
              <tr key={`empty-${i}`} style={{ height: 20 }}>
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
