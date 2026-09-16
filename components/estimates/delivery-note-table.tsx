import type { ProfileOption } from "@/lib/estimates/types";

/**
 * 거래명세서 한 장(공급받는자 보관용 또는 공급자 보관용) 을 그리는 순수
 * 표시용 컴포넌트. 사용자가 제공한 실제 거래명세서 원본 PDF(거래명세서(인더씨).pdf)를
 * 픽셀 단위로 분석해 색상·테두리·칸 비율을 그대로 옮겼다:
 *  - 공급받는자 보관용은 파란색(#0432FE), 공급자 보관용은 빨간색(#FE2500) 톤 —
 *    원본에서도 두 보관용 사본이 서로 다른 색으로 구분되어 있었다.
 *  - 셀 배경은 전부 흰색이다(옅은 하늘색 배경 같은 것은 원본에 없었다 — 라벨
 *    텍스트 자체가 테마 색이라 배경 없이도 구분되어 보인다).
 *  - 라벨(상호, 사업장주소 등)은 굵은 테마색, 값은 검정 일반체 — 등록번호/
 *    합계금액 값만 더 크고 굵은 검정으로 강조.
 *  - 인수자/납품자 서명란은 "이름 + 인" 한 셀에 이어 쓰고, 납품자 쪽만 그
 *    "인" 위에 대표자 도장 이미지를 겹쳐 찍은 것처럼 올린다.
 *
 * 정보 블록과 품목 표가 같은 <colgroup>(13칸)을 공유한다 — 원본 PDF의 실제
 * 칸 경계를 픽셀로 측정해 13개 슬롯 비율을 도출했고(년/월/일 각 1슬롯,
 * 품목 2슬롯, 규격 2슬롯, 수량/단가 각 1슬롯, 공급가액 3슬롯, 세액 1슬롯),
 * 정보 블록·서명란은 이 슬롯들을 다른 조합의 colSpan 으로 재사용한다.
 */
export interface DeliveryNoteRow {
  seq: number;
  key: string | number;
  name: string;
  spec: string;
  quantity: number;
  /** 공급가액 ÷ 수량 (역산한 공급단가, 부가세 제외) — 화면 표시용. */
  unitPrice: number;
  /** 공급가액 (부가세 제외) */
  supplyAmount: number;
  /** 세액 */
  vat: number;
}

interface DeliveryNoteTableProps {
  copyLabel: "공급받는자 보관용" | "공급자 보관용";
  date: string;
  provider: ProfileOption | null;
  receiver: ProfileOption | null;
  rows: DeliveryNoteRow[];
  /** 부가세 포함 최종 합계금액 — 견적서 합계와 항상 동일한 값. */
  grandTotal: number;
}

function fmtNum(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

/** 원본 양식은 날짜를 "년/월/일" 세 칸으로 따로 나눠 표기한다(YY 두 자리). */
function splitDate(date: string): { yy: string; mm: string; dd: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return { yy: "-", mm: "-", dd: "-" };
  const [, yyyy, mm, dd] = match;
  return { yy: yyyy.slice(2), mm: String(Number(mm)), dd: String(Number(dd)) };
}

// 원본 PDF 픽셀 측정값 그대로: 공급받는자 보관용=파란색, 공급자 보관용=빨간색.
const THEME_COLOR: Record<DeliveryNoteTableProps["copyLabel"], string> = {
  "공급받는자 보관용": "#0432FE",
  "공급자 보관용": "#FE2500",
};

// 원본 PDF를 4배 확대해 테두리 픽셀 좌표를 측정, 13개 슬롯 비율(합계 100)로 환산한 값.
// [년,월,일, 품목×2, 규격×2, 수량, 단가, 공급가액×3, 세액]
const COL_WIDTHS = [4, 4, 4, 6, 18, 12, 3, 12, 12, 6, 6, 3, 10];
const MIN_DATA_ROWS = 6;

export function DeliveryNoteTable({
  copyLabel,
  date,
  provider,
  receiver,
  rows,
  grandTotal,
}: DeliveryNoteTableProps) {
  const theme = THEME_COLOR[copyLabel];
  const { yy, mm, dd } = splitDate(date);
  const totalCols = COL_WIDTHS.length; // 13
  const totalDataRows = Math.max(MIN_DATA_ROWS, rows.length);

  const stampSrc = provider?.stampUrl?.trim() || "/mock-stamp.png";

  const colgroup = (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: `${w}%` }} />
      ))}
    </colgroup>
  );

  const border = { borderColor: theme };
  const cellBase = "border bg-white px-0.5 text-[8px] leading-tight";
  const label = `${cellBase} text-center font-bold`;
  const valueCenter = `${cellBase} text-center text-gray-900`;
  const valueLeft = `${cellBase} text-left text-gray-900`;
  const valueRight = `${cellBase} text-right text-gray-900`;
  const emphasisValue = `${cellBase} text-right font-bold text-[10px] text-gray-900`;

  return (
    <div className="delivery-note-copy" style={{ border: `2px solid ${theme}` }}>
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        {colgroup}
        <tbody>
          {/* ── 제목 ──────────────────────────────────────────────────── */}
          <tr style={{ height: 22 }}>
            <td colSpan={totalCols} className="border-0 bg-white text-center" style={border}>
              <span className="text-[13px] font-bold" style={{ color: theme }}>
                거래명세서
              </span>
              <span className="ml-1.5 text-[9px] font-normal" style={{ color: theme }}>
                ({copyLabel})
              </span>
            </td>
          </tr>

          {/* ── 공급받는자(좌) / 공급자(우) 정보, 4행 × 13칸 ─────────────── */}
          {/* R1: 공급받는자(1) 상호라벨(3) 상호값(2) | 공급자(1) 등록번호라벨(1) 등록번호값(5) */}
          <tr style={{ height: 16 }}>
            <td rowSpan={4} colSpan={1} className={label} style={{ ...border, color: theme }}>
              공급받는자
            </td>
            <td colSpan={3} className={label} style={{ ...border, color: theme }}>
              상호(법인명)
            </td>
            <td colSpan={2} className={valueCenter} style={border}>
              {receiver?.name ?? "-"}
            </td>
            <td rowSpan={4} colSpan={1} className={label} style={{ ...border, color: theme }}>
              공급자
            </td>
            <td colSpan={1} className={label} style={{ ...border, color: theme }}>
              등록번호
            </td>
            <td colSpan={5} className={emphasisValue} style={border}>
              {provider?.businessNumber ?? "-"}
            </td>
          </tr>
          {/* R2: 사업장주소라벨(3) 사업장주소값(2) | 상호라벨(1) 상호값(2) 성명라벨(1) 성명값(2) */}
          <tr style={{ height: 16 }}>
            <td colSpan={3} className={label} style={{ ...border, color: theme }}>
              사업장주소
            </td>
            <td colSpan={2} className={valueLeft} style={border}>
              {receiver?.address ?? "-"}
            </td>
            <td colSpan={1} className={label} style={{ ...border, color: theme }}>
              상호(법인명)
            </td>
            <td colSpan={2} className={valueCenter} style={border}>
              {provider?.name ?? "-"}
            </td>
            <td colSpan={1} className={label} style={{ ...border, color: theme }}>
              성명
            </td>
            <td
              colSpan={2}
              className="relative overflow-visible border bg-white px-0.5 text-center text-[8px] leading-tight text-gray-900"
              style={border}
            >
              {provider?.representative ?? "-"}
              {provider && (
                <img
                  src={stampSrc}
                  alt="도장"
                  className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2 overflow-visible mix-blend-multiply"
                  style={{ width: 16, height: 16, maxWidth: "none" }}
                />
              )}
            </td>
          </tr>
          {/* R3: 전화번호라벨(3) 전화번호값(2) | 사업장주소라벨(1) 사업장주소값(5) */}
          <tr style={{ height: 16 }}>
            <td colSpan={3} className={label} style={{ ...border, color: theme }}>
              전화번호
            </td>
            <td colSpan={2} className={valueCenter} style={border}>
              {receiver?.contact ?? "-"}
            </td>
            <td colSpan={1} className={label} style={{ ...border, color: theme }}>
              사업장주소
            </td>
            <td colSpan={5} className={valueLeft} style={border}>
              {provider?.address ?? "-"}
            </td>
          </tr>
          {/* R4: 합계금액라벨(3) 합계금액값(2) | 전화라벨(1) 전화값(2) 팩스라벨(1) 팩스값(2) */}
          <tr style={{ height: 16 }}>
            <td colSpan={3} className={label} style={{ ...border, color: theme }}>
              합계금액(VAT포함)
            </td>
            <td colSpan={2} className={emphasisValue} style={border}>
              {fmtNum(grandTotal)}
            </td>
            <td colSpan={1} className={label} style={{ ...border, color: theme }}>
              전화
            </td>
            <td colSpan={2} className={valueCenter} style={border}>
              {provider?.contact ?? "-"}
            </td>
            <td colSpan={1} className={label} style={{ ...border, color: theme }}>
              팩스
            </td>
            <td colSpan={2} className={valueCenter} style={border}>
              {provider?.fax ?? "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        {colgroup}
        <thead>
          <tr style={{ height: 16 }}>
            <td className={label} style={{ ...border, color: theme }}>년</td>
            <td className={label} style={{ ...border, color: theme }}>월</td>
            <td className={label} style={{ ...border, color: theme }}>일</td>
            <td colSpan={2} className={label} style={{ ...border, color: theme }}>품&nbsp;목</td>
            <td colSpan={2} className={label} style={{ ...border, color: theme }}>규격</td>
            <td className={label} style={{ ...border, color: theme }}>수량</td>
            <td className={label} style={{ ...border, color: theme }}>단가</td>
            <td colSpan={3} className={label} style={{ ...border, color: theme }}>공급가액</td>
            <td className={label} style={{ ...border, color: theme }}>세액</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} style={{ height: 16 }}>
              <td className={valueCenter} style={border}>{index === 0 ? yy : ""}</td>
              <td className={valueCenter} style={border}>{index === 0 ? mm : ""}</td>
              <td className={valueCenter} style={border}>{index === 0 ? dd : ""}</td>
              <td colSpan={2} className={`${valueLeft} break-keep break-words`} style={border}>
                {row.name}
              </td>
              <td colSpan={2} className={valueCenter} style={border}>{row.spec}</td>
              <td className={valueRight} style={border}>{row.quantity}</td>
              <td className={valueRight} style={border}>{fmtNum(row.unitPrice)}</td>
              <td colSpan={3} className={valueRight} style={border}>{fmtNum(row.supplyAmount)}</td>
              <td className={valueRight} style={border}>{fmtNum(row.vat)}</td>
            </tr>
          ))}
          {Array.from({ length: totalDataRows - rows.length }).map((_, i) => (
            <tr key={`blank-${i}`} style={{ height: 16 }}>
              {Array.from({ length: totalCols }).map((_, c) => (
                <td key={c} className={cellBase} style={border} />
              ))}
            </tr>
          ))}
          {/* ── 서명란: 인수자(4) 값(1) | 납품자(1) 값+도장(4) | 미수금 라벨+값 병합(3) ── */}
          <tr style={{ height: 22 }}>
            <td colSpan={4} className={label} style={{ ...border, color: theme }}>
              인수자
            </td>
            <td colSpan={1} className={`${valueCenter} font-medium`} style={border}>
              {receiver?.name ?? "-"}
              <span style={{ color: theme }}>&nbsp;&nbsp;인</span>
            </td>
            <td colSpan={1} className={label} style={{ ...border, color: theme }}>
              납품자
            </td>
            <td
              colSpan={4}
              className="relative overflow-visible border bg-white text-center text-[8px] font-medium text-gray-900"
              style={border}
            >
              {provider?.representative ?? "-"}
              <span style={{ color: theme }}>&nbsp;&nbsp;인</span>
              {provider && (
                <img
                  src={stampSrc}
                  alt="도장"
                  className="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 overflow-visible mix-blend-multiply"
                  style={{ width: 20, height: 20, maxWidth: "none" }}
                />
              )}
            </td>
            <td colSpan={3} className={cellBase} style={border}>
              <div className="flex h-full items-center justify-between">
                <span className="font-bold" style={{ color: theme }}>미수금</span>
                <span className="text-gray-900">&nbsp;</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
