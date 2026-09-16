import type { ProfileOption } from "@/lib/estimates/types";

/**
 * 거래명세서 한 장(공급받는자 보관용 또는 공급자 보관용) 을 그리는 순수
 * 표시용 컴포넌트. 실제 사용 중인 거래명세서 엑셀 원본(염주체육관 다이빙풀
 * 거래명세서.xlsx)을 그대로 참고해 필드 구성·순서를 맞췄다 — 원본은 A4
 * 한 장에 이 표를 위/아래로 두 번(공급받는자용/공급자용) 넣고 83%로
 * 축소 인쇄하는 방식이라, 이 컴포넌트도 한 페이지에 두 번 렌더링하는
 * 것을 전제로 최대한 작게(작은 폰트/좁은 행) 만들었다.
 *
 * 견적서 표(estimate-document-table.tsx)와 달리 이 문서는 "공급가액"과
 * "세액"을 별도 컬럼으로 나눠 보여준다 — 다만 새로 세금을 얹는 게 아니라,
 * 견적서에 이미 확정된 부가세 포함 최종 금액(amount)을 역산해서 공급가액/
 * 세액으로 나눈 것이다(calculateInclusiveVat 재사용) — 그래야 견적서와
 * 거래명세서의 합계금액이 항상 정확히 같다.
 *
 * 정보 블록과 품목 표가 같은 <colgroup>(12칸)을 공유한다 — 견적서 표와
 * 동일한 방식으로, 두 표의 테두리가 세로로 가지런히 맞물리게 하기 위함.
 * 품목 표는 [년|월|일|품목×3|규격×2|수량|단가|공급가액|세액] = 12칸을
 * colSpan 으로 나눠 쓰고, 정보 블록은 같은 12칸을 라벨/값 배치에 맞게
 * 다른 비율로 나눠 쓴다.
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

// 원본 견적서 표와 같은 톤(전부 흰 배경, 검정 테두리)을 쓴다 — 별도 강조색은 쓰지 않는다.
const CELL = "border border-black bg-white px-0.5 text-[8px] leading-tight text-gray-900";
const CELL_C = `${CELL} text-center`;
const LABEL_CELL = `${CELL_C} font-bold bg-gray-50`;

// 정보 블록과 품목 표가 공유하는 12칸 비율. 품목 표 기준으로 이름을 붙였다
// (년/월/일/품명×3/규격×2/수량/단가/공급가액/세액) — 정보 블록은 이 칸들을
// 다른 조합의 colSpan 으로 재사용한다(견적서 표와 동일한 방식).
const COL_WIDTHS = [4, 4, 4, 9, 9, 9, 8, 8, 9, 12, 12, 12];
const MIN_DATA_ROWS = 6;

export function DeliveryNoteTable({
  copyLabel,
  date,
  provider,
  receiver,
  rows,
  grandTotal,
}: DeliveryNoteTableProps) {
  const { yy, mm, dd } = splitDate(date);
  const totalCols = COL_WIDTHS.length; // 12
  const totalW = COL_WIDTHS.reduce((a, b) => a + b, 0);
  const totalDataRows = Math.max(MIN_DATA_ROWS, rows.length);

  const stampSrc = provider?.stampUrl?.trim() || "/mock-stamp.png";

  const colgroup = (
    <colgroup>
      {COL_WIDTHS.map((w, i) => (
        <col key={i} style={{ width: `${(w / totalW) * 100}%` }} />
      ))}
    </colgroup>
  );

  return (
    <div className="delivery-note-copy">
      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        {colgroup}
        <tbody>
          {/* ── 제목 ──────────────────────────────────────────────────── */}
          <tr style={{ height: 20 }}>
            <td
              colSpan={totalCols}
              className="border-0 bg-white text-center text-[13px] font-bold text-gray-900"
            >
              거&nbsp;&nbsp;래&nbsp;&nbsp;명&nbsp;&nbsp;세&nbsp;&nbsp;서
              <span className="ml-1.5 text-[9px] font-normal">({copyLabel})</span>
            </td>
          </tr>

          {/* ── 공급받는자(좌) / 공급자(우) 정보, 4행 × 12칸 ─────────────── */}
          {/* R1: 공급받는자(2) 상호라벨(1) 상호값(3) | 공급자(2) 등록번호라벨(1) 등록번호값(3) */}
          <tr style={{ height: 16 }}>
            <td rowSpan={4} colSpan={2} className={LABEL_CELL}>공급받는자</td>
            <td className={LABEL_CELL}>상호(법인명)</td>
            <td colSpan={3} className={CELL_C}>{receiver?.name ?? "-"}</td>
            <td rowSpan={4} colSpan={2} className={LABEL_CELL}>공급자</td>
            <td className={LABEL_CELL}>등록번호</td>
            <td colSpan={3} className={CELL_C}>{provider?.businessNumber ?? "-"}</td>
          </tr>
          {/* R2: 사업장주소라벨(1) 사업장주소값(3) | 상호라벨(1) 상호값(1) 성명라벨(1) 성명값(1) */}
          <tr style={{ height: 16 }}>
            <td className={LABEL_CELL}>사업장주소</td>
            <td colSpan={3} className={CELL_C}>{receiver?.address ?? "-"}</td>
            <td className={LABEL_CELL}>상호(법인명)</td>
            <td className={CELL_C}>{provider?.name ?? "-"}</td>
            <td className={LABEL_CELL}>성명</td>
            <td className={CELL_C}>{provider?.representative ?? "-"}</td>
          </tr>
          {/* R3: 전화번호라벨(1) 전화번호값(3) | 사업장주소라벨(1) 사업장주소값(3) */}
          <tr style={{ height: 16 }}>
            <td className={LABEL_CELL}>전화번호</td>
            <td colSpan={3} className={CELL_C}>{receiver?.contact ?? "-"}</td>
            <td className={LABEL_CELL}>사업장주소</td>
            <td colSpan={3} className={CELL_C}>{provider?.address ?? "-"}</td>
          </tr>
          {/* R4: 합계금액라벨(2) 합계금액값(2) | 전화라벨(1) 전화값(1) 팩스라벨(1) 팩스값(1) */}
          <tr style={{ height: 16 }}>
            <td colSpan={2} className={LABEL_CELL}>합계금액(VAT포함)</td>
            <td colSpan={2} className={`${CELL} text-right font-bold`}>
              {fmtNum(grandTotal)} 원
            </td>
            <td className={LABEL_CELL}>전화</td>
            <td className={CELL_C}>{provider?.contact ?? "-"}</td>
            <td className={LABEL_CELL}>팩스</td>
            <td className={CELL_C}>{provider?.fax ?? "-"}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
        {colgroup}
        <thead>
          <tr style={{ height: 16 }}>
            <td className={LABEL_CELL}>년</td>
            <td className={LABEL_CELL}>월</td>
            <td className={LABEL_CELL}>일</td>
            <td colSpan={3} className={LABEL_CELL}>품&nbsp;목</td>
            <td colSpan={2} className={LABEL_CELL}>규격</td>
            <td className={LABEL_CELL}>수량</td>
            <td className={LABEL_CELL}>단가</td>
            <td className={LABEL_CELL}>공급가액</td>
            <td className={LABEL_CELL}>세액</td>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.key} style={{ height: 16 }}>
              <td className={CELL_C}>{index === 0 ? yy : ""}</td>
              <td className={CELL_C}>{index === 0 ? mm : ""}</td>
              <td className={CELL_C}>{index === 0 ? dd : ""}</td>
              <td colSpan={3} className={`${CELL} break-keep break-words`}>{row.name}</td>
              <td colSpan={2} className={CELL_C}>{row.spec}</td>
              <td className={CELL_C}>{row.quantity}</td>
              <td className={`${CELL} text-right`}>{fmtNum(row.unitPrice)}</td>
              <td className={`${CELL} text-right`}>{fmtNum(row.supplyAmount)}</td>
              <td className={`${CELL} text-right`}>{fmtNum(row.vat)}</td>
            </tr>
          ))}
          {Array.from({ length: totalDataRows - rows.length }).map((_, i) => (
            <tr key={`blank-${i}`} style={{ height: 16 }}>
              {Array.from({ length: totalCols }).map((_, c) => (
                <td key={c} className={CELL} />
              ))}
            </tr>
          ))}
          {/* ── 서명란: 인수자 / 납품자 / 미수금 ──────────────────────── */}
          <tr style={{ height: 22 }}>
            <td colSpan={2} className={LABEL_CELL}>인수자</td>
            <td colSpan={3} className={`${CELL_C} font-medium`}>{receiver?.name ?? "-"}</td>
            <td colSpan={2} className={CELL_C}>(인)</td>
            <td colSpan={2} className={LABEL_CELL}>납품자</td>
            <td
              colSpan={3}
              className="relative overflow-visible border border-black bg-white text-center text-[8px] font-medium"
            >
              {provider?.representative ?? "-"}
              {provider && (
                <img
                  src={stampSrc}
                  alt="도장"
                  className="pointer-events-none absolute right-1 top-1/2 z-10 -translate-y-1/2 overflow-visible mix-blend-multiply"
                  style={{ width: 20, height: 20, maxWidth: "none" }}
                />
              )}
            </td>
          </tr>
          <tr style={{ height: 22 }}>
            <td colSpan={2} className={LABEL_CELL}>미&nbsp;수&nbsp;금</td>
            <td colSpan={10} className={`${CELL} text-right`}>&nbsp;</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
