import "server-only";
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import type { ProfileOption } from "@/lib/estimates/types";
import { formatDiscountRate, type PriceTier } from "@/lib/estimates/pricing";

// ── 관공서 납품용 견적서 컬럼 구조 (A=1 ~ 13+N열) ───────────────────────────
// 실제 제공된 원본 견적서 스크린샷을 픽셀 단위로 측정해서 비율을 맞춘 원본
// 13열(No=84px, 품명=172px, 규격=356px, 단위=90px, 수량=64px, 단가=124px,
//  금액=150px, 부가세=94px, 적요=136px, 표 전체 폭=1270px 기준)에, "수량"과
// "단가" 사이에 체크된 참고 등급 수(N, 0~4개)만큼 열(각 7.0)을 끼워 넣어
// 13+N 열로 동적으로 확장한다 — 화면 미리보기(estimate-document-table.tsx)
// 와 동일한 폭 비율/열 구조. N=0이면 원본 13열 그대로다.
// A:No  B-C:품명  D-E:규격  F:단위  G:수량  [H..]:참고등급×N  [..]:단가(2)  [..]:금액(2)  [..]:부가세  [..]:적요
const COL_WIDTHS_BASE = [6.6, 6.75, 6.75, 14, 14, 7.1, 5, 4.9, 4.9, 5.9, 5.9, 7.4, 10.7];
const REFERENCE_COL_WIDTH = 7.0;

// 테이블 최소 행 수 (이하여백 포함)
const MIN_DATA_ROWS = 13;
const TABLE_START_ROW = 10;

const FONT_NAME = "맑은 고딕";

const DAY_OF_WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];

export interface WorkbookEstimateItem {
  seq: number;
  name: string;        // 품명 (brand + 장비명)
  spec: string;        // 규격 (색상/사이즈 옵션)
  unit: string;        // 단위 (예: "개")
  quantity: number;    // 수량
  unitPrice: number;   // 단가
  amount: number;      // 금액 (unitPrice × quantity)
  vat: number;         // 부가세 (amount × 10%)
  itemRemarks: string; // 적요
  discountRate: number; // 소비자가격 대비 할인율(%), 0이면 표시 안 함
  /**
   * 참고용으로 함께 노출할 등급들의 단가 목록(params.referenceTierLabels 와
   * 같은 순서/길이). 단순 참고 표시 컬럼 — unitPrice/amount/vat 계산에는
   * 전혀 관여하지 않는다.
   */
  referenceValues: number[];
}

export interface BuildEstimateWorkbookParams {
  estimateNumber: string;
  date: string;
  provider: ProfileOption;
  receiver: ProfileOption;
  remarks: string;
  priceTier: PriceTier;
  /** 체크된 참고 가격 등급들의 표시 이름(선택된 순서 그대로). 없으면 원본 13열 그대로. */
  referenceTierLabels: string[];
  items: WorkbookEstimateItem[];
}

// ── 색상 & 스타일 상수 ────────────────────────────────────────────────────────
// 원본 견적서 스크린샷에서 실측한 색상. 원본은 배경색 채우기를 전혀 쓰지 않고
// (전부 흰 배경) 테두리 색상만 구역별로 다르게 써서 시각적으로 구분한다.
//   - 제목 영역 테두리: 초록 (#3A714A)
//   - 공급자 정보 그리드 테두리: 남보라 (#666695)
//   - 그 외(수신자 금액 박스, 품목 표, 합계, 비고): 검정
const C = {
  WHITE: "FFFFFFFF",
  BLACK: "FF000000",
  GREEN: "FF3A714A",
  PURPLE: "FF666695",
  GRAY_BORDER: "FFD4D4D4",
};

function borderOf(color: string, style: ExcelJS.BorderStyle = "thin"): Partial<ExcelJS.Borders> {
  const s: ExcelJS.Border = { style, color: { argb: color } };
  return { top: s, left: s, bottom: s, right: s };
}

function fill(argb: string): ExcelJS.Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb: argb } };
}

// 레이블 셀 (흰 배경, 일반 굵기, 가운데 정렬) — 원본은 레이블도 배경색이 없다.
function labelCell(
  cell: ExcelJS.Cell,
  text: string,
  opts?: { size?: number; align?: ExcelJS.Alignment["horizontal"]; border?: string; bold?: boolean }
) {
  cell.value = text;
  cell.fill = fill(C.WHITE);
  cell.font = { name: FONT_NAME, bold: opts?.bold ?? false, size: opts?.size ?? 10, color: { argb: C.BLACK } };
  cell.alignment = { horizontal: opts?.align ?? "center", vertical: "middle", wrapText: true };
  cell.border = borderOf(opts?.border ?? C.BLACK);
}

// 값 셀
function valueCell(
  cell: ExcelJS.Cell,
  value: ExcelJS.CellValue,
  opts?: {
    align?: ExcelJS.Alignment["horizontal"];
    bold?: boolean;
    size?: number;
    color?: string;
    fmt?: string;
    border?: string;
  }
) {
  cell.value = value;
  cell.fill = fill(C.WHITE);
  cell.font = { name: FONT_NAME, size: opts?.size ?? 10, bold: opts?.bold ?? false, color: { argb: opts?.color ?? C.BLACK } };
  cell.alignment = { horizontal: opts?.align ?? "center", vertical: "middle", wrapText: true };
  cell.border = borderOf(opts?.border ?? C.BLACK);
  if (opts?.fmt) cell.numFmt = opts.fmt;
}

// 금액 포맷 문자열 생성 (₩ 기호 없이 콤마만 — 원본에 통화 기호가 전혀 없다)
function fmtWon(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

function formatDisplayDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  const display = date.replace(/-/g, ".");
  if (Number.isNaN(parsed.getTime())) return display;
  return `${display}(${DAY_OF_WEEK_KO[parsed.getDay()]})`;
}

// 공급자에 등록된 도장이 없거나 다운로드에 실패했을 때 대신 사용할 기본(MOCK) 인감.
// public/mock-stamp.png (빨간 원형 "MOCK 인감" 표시) 을 서버에서 직접 읽어 base64 로 캐시한다.
const MOCK_STAMP_BASE64: string | null = (() => {
  try {
    const filePath = path.join(process.cwd(), "public", "mock-stamp.png");
    const buf = fs.readFileSync(filePath);
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
})();

const DATA_URI_REGEX = /^data:image\/(png|jpe?g|gif);base64,/i;

function normalizeImageExtension(mime: string): "png" | "jpeg" | "gif" | null {
  const lower = mime.toLowerCase();
  if (lower === "png") return "png";
  if (lower === "jpeg" || lower === "jpg") return "jpeg";
  if (lower === "gif") return "gif";
  return null;
}

/**
 * 프로필 등록 화면에서 파일 업로드로 저장된 도장은 base64 data URI
 * (`data:image/png;base64,....`) 형태로 저장되어 있으므로, 네트워크 요청 없이
 * 바로 파싱한다. exceljs 가 지원하는 형식은 png/jpeg/gif 뿐이라, 그 외
 * 형식(webp 등)이거나 파싱에 실패하면 MOCK 인감으로 대체한다.
 */
function parseStampDataUri(
  stampUrl: string
): { base64: string; extension: "png" | "jpeg" | "gif" } | null {
  const match = stampUrl.match(DATA_URI_REGEX);
  if (!match) return null;
  const extension = normalizeImageExtension(match[1]);
  if (!extension) return null;
  return { base64: stampUrl, extension };
}

// 과거에 URL 문자열로 등록된 도장(레거시 데이터)을 위한 다운로드 폴백.
async function downloadStampImage(
  stampUrl: string
): Promise<{ base64: string; extension: "png" | "jpeg" | "gif" } | null> {
  try {
    const response = await fetch(stampUrl);
    if (!response.ok) return null;
    const ct = response.headers.get("content-type") ?? "";
    const url = stampUrl.toLowerCase();
    const ext: "png" | "jpeg" | "gif" | null =
      ct.includes("png") || url.includes(".png") ? "png" :
      ct.includes("jpeg") || ct.includes("jpg") || url.includes(".jpg") || url.includes(".jpeg") ? "jpeg" :
      ct.includes("gif") || url.includes(".gif") ? "gif" : null;
    if (!ext) return null;
    const buf = await response.arrayBuffer();
    const base64 = `data:image/${ext};base64,${Buffer.from(buf).toString("base64")}`;
    return { base64, extension: ext };
  } catch {
    return null;
  }
}

// 도장 이미지 확보. 등록된 도장이 없거나 가져오지 못하면 기본 MOCK 인감으로 대체한다.
async function fetchStampImage(
  stampUrl: string | null | undefined
): Promise<{ base64: string; extension: "png" | "jpeg" | "gif" } | null> {
  if (stampUrl) {
    const parsed = stampUrl.startsWith("data:")
      ? parseStampDataUri(stampUrl)
      : await downloadStampImage(stampUrl);
    if (parsed) return parsed;
  }

  if (MOCK_STAMP_BASE64) {
    return { base64: MOCK_STAMP_BASE64, extension: "png" };
  }
  return null;
}

/**
 * 관공서 납품용 견적서를 exceljs 로 생성합니다.
 */
export async function buildEstimateWorkbook(
  params: BuildEstimateWorkbookParams
): Promise<Buffer> {
  const { estimateNumber, date, provider, receiver, remarks, priceTier, referenceTierLabels, items } = params;

  // 참고 등급 열 개수(N). "수량"과 "단가" 사이에 끼워 넣은 만큼, 그 뒤(단가/
  // 금액/부가세/적요)의 모든 열 번호가 N칸씩 밀린다 — 아래 리터럴 열 번호는
  // 전부 N=0(원본 13열) 기준에 N을 더한 것이다.
  const refCount = referenceTierLabels.length;
  const COL_WIDTHS = [
    ...COL_WIDTHS_BASE.slice(0, 7),
    ...Array.from({ length: refCount }, () => REFERENCE_COL_WIDTH),
    ...COL_WIDTHS_BASE.slice(7),
  ];
  const TOTAL_COLS = COL_WIDTHS.length; // 13 + refCount
  // 단가/금액/부가세/적요 열의 시작 번호(N=0일 때의 원본 13열 기준 8,10,12,13
  // 에 해당) — 참고 등급 열이 끼어든 만큼 그대로 밀어서 재사용한다.
  const UNIT_PRICE_COL = 8 + refCount;
  const AMOUNT_COL = 10 + refCount;
  const VAT_COL = 12 + refCount;
  const REMARKS_COL = 13 + refCount;

  // ── 금액 계산 ──────────────────────────────────────────────────────────────
  // 부가세 포함가 정책: item.amount(단가×수량)는 이미 부가세가 포함된 최종
  // 판매 금액이다. 부가세 금액/공급가액 역산 표기는 오히려 헷갈린다는
  // 피드백에 따라 문서에는 더 이상 부가세 관련 숫자를 쓰지 않는다(item.vat
  // 자체는 호출부가 여전히 계산해서 넘기지만 여기서 쓰지 않을 뿐이다) —
  // "공급금액"도 그냥 합계금액과 같은 값을 보여준다.
  const grandTotal = items.reduce((s, i) => s + i.amount, 0);
  const totalSupply = grandTotal;

  // ── 워크북 초기화 ──────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "스마트 다이빙 장비 관리 시스템";
  wb.created = new Date();

  const ws = wb.addWorksheet("견적서", {
    pageSetup: {
      paperSize: 9, // A4
      orientation: "portrait",
      fitToPage: true,
      fitToWidth: 1, // 가로는 항상 A4 한 장 너비로 강제 고정
      fitToHeight: 0, // 세로는 내용 양에 따라 자동(가로 비율은 유지)
      margins: {
        left: 0.5,
        right: 0.5,
        top: 0.6,
        bottom: 0.6,
        header: 0.3,
        footer: 0.3,
      },
    },
  });

  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ── R1: 제목 ("견 적 서" — 위/아래 초록 테두리) ────────────────────────────
  ws.mergeCells(1, 1, 1, TOTAL_COLS);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = "견    적    서";
  titleCell.font = { name: FONT_NAME, bold: true, size: 26, color: { argb: C.BLACK } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.fill = fill(C.WHITE);
  titleCell.border = { top: { style: "thin", color: { argb: C.GREEN } } };
  ws.getRow(1).height = 50;

  // ── R2: 발행일자(요일 포함) / 견적번호 — 원본에는 "발행일자:" 라벨이 없다 ──
  ws.mergeCells(2, 1, 2, TOTAL_COLS);
  const dateNoCell = ws.getCell(2, 1);
  dateNoCell.value = `${formatDisplayDate(date)}   No.${estimateNumber}`;
  dateNoCell.font = { name: FONT_NAME, size: 11, color: { argb: C.BLACK } };
  dateNoCell.alignment = { horizontal: "right", vertical: "middle" };
  dateNoCell.fill = fill(C.WHITE);
  dateNoCell.border = { bottom: { style: "medium", color: { argb: C.GREEN } } };
  ws.getRow(2).height = 22;

  // ── R3~R7: 공급받는자/금액 요약(좌) + 공급자 정보(우) ────────────────────
  // 원본 스크린샷 실측 결과, 이 영역엔 "공급받는자"/"공급자" 배너가 없고
  // 바로 내용이 시작된다. 왼쪽(수신자명+금액 3줄)엔 연회색 테두리, 오른쪽
  // (공급자 상세 5줄)엔 남보라색 테두리 그리드를 쓴다.
  const INFO_TOP_ROW = 3;
  const INFO_ROWS = 5;
  const receiverRow = INFO_TOP_ROW; // "OOO 귀하"
  const remarksLeadRow = INFO_TOP_ROW + INFO_ROWS - 1; // "아래와 같이 견적 합니다."

  for (let r = INFO_TOP_ROW; r < INFO_TOP_ROW + INFO_ROWS; r++) {
    ws.getRow(r).height = 30;
  }

  // 좌측: "OOO 귀하" (테두리 없음, 굵게, 밑줄)
  ws.mergeCells(receiverRow, 1, receiverRow, 5);
  const receiverCell = ws.getCell(receiverRow, 1);
  receiverCell.value = `${receiver.name}   귀하`;
  receiverCell.font = { name: FONT_NAME, bold: true, size: 14, underline: true, color: { argb: C.BLACK } };
  receiverCell.alignment = { horizontal: "left", vertical: "bottom" };
  receiverCell.fill = fill(C.WHITE);

  // 좌측: 공급금액 / 부가세 / 합계금액 (연회색 테두리 박스, 라벨=col1-3, 값=col4-5)
  // 부가세 행은 값을 표시하지 않는다(value: null → 빈 셀).
  const amountRows: { row: number; label: string; value: number | null; bold: boolean; suffix: string }[] = [
    { row: INFO_TOP_ROW + 1, label: "공급금액", value: totalSupply, bold: false, suffix: " 원" },
    { row: INFO_TOP_ROW + 2, label: "부가세", value: null, bold: false, suffix: "" },
    { row: INFO_TOP_ROW + 3, label: "합계금액", value: grandTotal, bold: true, suffix: " 원" },
  ];
  for (const { row, label, value, bold, suffix } of amountRows) {
    ws.mergeCells(row, 1, row, 3);
    labelCell(ws.getCell(row, 1), label, { align: "left", border: C.GRAY_BORDER, bold });
    ws.mergeCells(row, 4, row, 5);
    valueCell(ws.getCell(row, 4), value === null ? "" : `${fmtWon(value)}${suffix}`, {
      align: "right",
      bold,
      size: bold ? 13 : 12,
      border: C.GRAY_BORDER,
    });
  }

  // 좌측: "아래와 같이 견적 합니다." (테두리 없음)
  ws.mergeCells(remarksLeadRow, 1, remarksLeadRow, 5);
  const leadCell = ws.getCell(remarksLeadRow, 1);
  leadCell.value = "아래와 같이 견적 합니다.";
  leadCell.font = { name: FONT_NAME, size: 10, color: { argb: C.BLACK } };
  leadCell.alignment = { horizontal: "left", vertical: "middle" };
  leadCell.fill = fill(C.WHITE);

  // 우측: "공급자" 세로 병합 라벨 (5행 전체, 남보라 테두리)
  ws.mergeCells(INFO_TOP_ROW, 6, INFO_TOP_ROW + INFO_ROWS - 1, 6);
  const supplierLabelCell = ws.getCell(INFO_TOP_ROW, 6);
  supplierLabelCell.value = "공급자";
  supplierLabelCell.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: C.BLACK } };
  supplierLabelCell.alignment = { horizontal: "center", vertical: "middle" };
  supplierLabelCell.fill = fill(C.WHITE);
  supplierLabelCell.border = borderOf(C.PURPLE);

  // 우측: 필드 라벨(col7) + 값(col8~14). 사업번호/주소는 값이 전체 폭으로
  // 병합되고(단일 필드), 상호+대표자/업태+종목/전화+이메일은 2필드로 나뉜다.
  const fieldRow = (
    row: number,
    label: string,
    value: string,
    opts: { bold?: boolean; size?: number } = {}
  ) => {
    labelCell(ws.getCell(row, 7), label, { border: C.PURPLE });
    ws.mergeCells(row, 8, row, TOTAL_COLS);
    valueCell(ws.getCell(row, 8), value, {
      align: "center",
      border: C.PURPLE,
      bold: opts.bold ?? false,
      size: opts.size ?? 11,
    });
  };

  const dualFieldRow = (
    row: number,
    label1: string,
    value1: string,
    label2: string,
    value2: string
  ) => {
    // value1 은 참고 등급 열(8..7+refCount) 폭까지 흡수해 그만큼 더 넓게
    // 병합한다(원본 8-11 에 refCount 를 더함) — 화면 미리보기에서 이 자리의
    // colSpan 을 +refCount 늘리는 것과 동일한 처리. label2/value2 는 그만큼
    // 뒤로 밀린다.
    labelCell(ws.getCell(row, 7), label1, { border: C.PURPLE });
    ws.mergeCells(row, 8, row, 11 + refCount);
    valueCell(ws.getCell(row, 8), value1, { align: "center", border: C.PURPLE });
    labelCell(ws.getCell(row, 12 + refCount), label2, { border: C.PURPLE });
    valueCell(ws.getCell(row, 13 + refCount), value2, { align: "center", border: C.PURPLE });
  };

  fieldRow(INFO_TOP_ROW, "사업번호", provider.businessNumber ?? "-", { bold: true, size: 14 });
  dualFieldRow(
    INFO_TOP_ROW + 1,
    "상호",
    provider.name,
    "대표자",
    provider.representative ?? "-"
  );
  fieldRow(INFO_TOP_ROW + 2, "주소", provider.address ?? "-");
  dualFieldRow(
    INFO_TOP_ROW + 3,
    "업태",
    provider.businessType ?? "-",
    "종목",
    provider.businessCategory ?? "-"
  );
  dualFieldRow(
    INFO_TOP_ROW + 4,
    "전화",
    provider.contact ?? "-",
    "이메일",
    provider.email ?? "-"
  );

  // ── 도장 이미지 ("대표자" 값 셀 위에 겹쳐 배치) ───────────────────────────
  // "상호+대표자" 행(INFO_TOP_ROW+1) 의 대표자 값은 REMARKS_COL(적요) 너비
  // 하나뿐이라 이름 글자 바로 우측부터 셀 끝까지 겹치도록 배치한다. 참고
  // 등급 열이 늘어난 만큼 대표자 값 칸도 뒤로 밀리므로, 0-based 오프셋도
  // 그만큼(REMARKS_COL - 1) 함께 밀어준다.
  const stamp = await fetchStampImage(provider.stampUrl);
  if (stamp) {
    const stampRow0 = INFO_TOP_ROW + 1 - 1; // 0-based
    const imgId = wb.addImage({ base64: stamp.base64, extension: stamp.extension });
    ws.addImage(imgId, {
      tl: { col: REMARKS_COL - 1 + 0.15, row: stampRow0 + 0.08 },
      ext: { width: 32, height: 32 },
    });
  }

  // ── 구분선 공백 ────────────────────────────────────────────────────────────
  const gapRow = INFO_TOP_ROW + INFO_ROWS;
  ws.getRow(gapRow).height = 8;

  // ── 테이블 헤더 (배경색 없이 흰 배경 + 굵은 검정 테두리, 원본과 동일) ──────
  const TABLE_HEADER_ROW = gapRow + 1;
  const tableHeaders: { cols: [number, number]; text: string; note?: string; small?: boolean }[] = [
    { cols: [1, 1], text: "No." },
    { cols: [2, 3], text: "품    명" },
    { cols: [4, 5], text: "규    격" },
    { cols: [6, 6], text: "단위" },
    { cols: [7, 7], text: "수량" },
    ...referenceTierLabels.map(
      (label, i): { cols: [number, number]; text: string; small: boolean } => ({
        cols: [8 + i, 8 + i],
        text: label,
        small: true,
      })
    ),
    { cols: [UNIT_PRICE_COL, UNIT_PRICE_COL + 1], text: "단    가", note: "(부가세포함)" },
    { cols: [AMOUNT_COL, AMOUNT_COL + 1], text: "금    액" },
    { cols: [VAT_COL, VAT_COL], text: "부가세" },
    { cols: [REMARKS_COL, REMARKS_COL], text: "적  요" },
  ];
  tableHeaders.forEach(({ cols, text, note, small }) => {
    if (cols[0] !== cols[1]) ws.mergeCells(TABLE_HEADER_ROW, cols[0], TABLE_HEADER_ROW, cols[1]);
    const cell = ws.getCell(TABLE_HEADER_ROW, cols[0]);
    cell.value = note
      ? {
          richText: [
            { font: { name: FONT_NAME, bold: true, size: 11, color: { argb: C.BLACK } }, text },
            { font: { name: FONT_NAME, size: 8, color: { argb: C.BLACK } }, text: `\n${note}` },
          ],
        }
      : text;
    cell.fill = fill(C.WHITE);
    cell.font = { name: FONT_NAME, bold: true, size: small ? 9 : 11, color: { argb: C.BLACK } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { ...borderOf(C.BLACK), top: { style: "medium", color: { argb: C.BLACK } } };
  });
  ws.getRow(TABLE_HEADER_ROW).height = 30;

  // ── 데이터 행 ─────────────────────────────────────────────────────────────
  const totalDataRows = Math.max(MIN_DATA_ROWS, items.length);
  let curRow = TABLE_START_ROW;

  for (let i = 0; i < items.length; i++, curRow++) {
    const item = items[i];
    const row = ws.getRow(curRow);

    const writeItemCell = (col: number, endCol: number, value: ExcelJS.CellValue, opts?: {
      align?: ExcelJS.Alignment["horizontal"]; fmt?: string; bold?: boolean;
    }) => {
      if (col !== endCol) ws.mergeCells(curRow, col, curRow, endCol);
      const cell = row.getCell(col);
      cell.value = value;
      cell.fill = fill(C.WHITE);
      cell.font = { name: FONT_NAME, size: 10, bold: opts?.bold ?? false, color: { argb: C.BLACK } };
      cell.alignment = { horizontal: opts?.align ?? "center", vertical: "middle", wrapText: true };
      cell.border = borderOf(C.BLACK);
      if (opts?.fmt) cell.numFmt = opts.fmt;
    };

    // 단가/금액 셀 — 할인율이 있으면 두 번째 줄에 작은 글씨로 할인율을 덧붙인다
    // (숫자 서식(numFmt)이 아닌 richText 이므로, 표시 문자열은 fmtWon 으로 직접 만든다).
    const writeMoneyCell = (col: number, endCol: number, value: number, discountSuffix: string | null) => {
      ws.mergeCells(curRow, col, curRow, endCol);
      const cell = row.getCell(col);
      if (discountSuffix) {
        cell.value = {
          richText: [
            { font: { name: FONT_NAME, size: 10, color: { argb: C.BLACK } }, text: fmtWon(value) },
            { font: { name: FONT_NAME, size: 8, color: { argb: "FF666666" } }, text: `\n${discountSuffix}` },
          ],
        };
      } else {
        cell.value = fmtWon(value);
      }
      cell.fill = fill(C.WHITE);
      cell.font = { name: FONT_NAME, size: 10, color: { argb: C.BLACK } };
      cell.alignment = { horizontal: "right", vertical: "middle", wrapText: true };
      cell.border = borderOf(C.BLACK);
    };

    const hasDiscount = item.discountRate > 0;
    const rateLabel = hasDiscount ? formatDiscountRate(item.discountRate) : null;

    writeItemCell(1, 1, item.seq, { align: "center" });
    writeItemCell(2, 3, item.name, { align: "left" });
    writeItemCell(4, 5, item.spec, { align: "center" });
    writeItemCell(6, 6, item.unit, { align: "center" });
    writeItemCell(7, 7, item.quantity, { align: "center" });
    item.referenceValues.forEach((value, i) => {
      writeItemCell(8 + i, 8 + i, fmtWon(value), { align: "right" });
    });
    writeMoneyCell(UNIT_PRICE_COL, UNIT_PRICE_COL + 1, item.unitPrice, rateLabel ? `${rateLabel}%↓` : null);
    writeMoneyCell(AMOUNT_COL, AMOUNT_COL + 1, item.amount, rateLabel ? `-${rateLabel}%` : null);
    writeItemCell(VAT_COL, VAT_COL, "", { align: "right" });
    writeItemCell(REMARKS_COL, REMARKS_COL, item.itemRemarks || "-", { align: "center" });
    row.height = hasDiscount ? 30 : 20;
  }

  // ── 이하여백 + 빈 행 채우기 ───────────────────────────────────────────────
  if (items.length < totalDataRows) {
    // "이하여백" 행
    ws.mergeCells(curRow, 1, curRow, TOTAL_COLS);
    const ihaCell = ws.getCell(curRow, 1);
    ihaCell.value = "~ 이 하 여 백 ~";
    ihaCell.fill = fill(C.WHITE);
    ihaCell.font = { name: FONT_NAME, size: 10, color: { argb: C.BLACK } };
    ihaCell.alignment = { horizontal: "center", vertical: "middle" };
    ihaCell.border = borderOf(C.BLACK);
    ws.getRow(curRow).height = 20;
    curRow++;

    // 나머지 빈 행
    const emptyRowsEnd = TABLE_START_ROW + totalDataRows - 1;
    for (; curRow <= emptyRowsEnd; curRow++) {
      for (let c = 1; c <= TOTAL_COLS; c++) {
        const cell = ws.getCell(curRow, c);
        cell.fill = fill(C.WHITE);
        cell.border = borderOf(C.BLACK);
      }
      ws.getRow(curRow).height = 20;
    }
  }

  // ── 총 계 행 (원본은 흰 배경 + 검정 글씨, 강조색 없음) ────────────────────
  const totalRow = TABLE_START_ROW + totalDataRows;
  ws.mergeCells(totalRow, 1, totalRow, 6);
  const totalLabel = ws.getCell(totalRow, 1);
  totalLabel.value = "총     계";
  totalLabel.fill = fill(C.WHITE);
  totalLabel.font = { name: FONT_NAME, bold: true, size: 11, color: { argb: C.BLACK } };
  totalLabel.alignment = { horizontal: "center", vertical: "middle" };
  totalLabel.border = borderOf(C.BLACK);

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const tcell = ws.getCell(totalRow, 7);
  tcell.value = totalQty;
  tcell.fill = fill(C.WHITE);
  tcell.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: C.BLACK } };
  tcell.alignment = { horizontal: "center", vertical: "middle" };
  tcell.border = borderOf(C.BLACK);

  // 참고 등급 열 합계 자리 (공백 — 참고용 표시 컬럼이라 합산하지 않는다).
  // refCount 가 0이면 이 열 자체가 없으므로(단가가 바로 col8부터 시작)
  // 건드리지 않는다 — 그렇지 않으면 단가 셀과 같은 칸을 두 번 쓰게 된다.
  if (refCount > 0) {
    ws.mergeCells(totalRow, 8, totalRow, 7 + refCount);
    const tRetailCell = ws.getCell(totalRow, 8);
    tRetailCell.fill = fill(C.WHITE);
    tRetailCell.border = borderOf(C.BLACK);
  }

  // 단가 합계 자리 (공백)
  ws.mergeCells(totalRow, UNIT_PRICE_COL, totalRow, UNIT_PRICE_COL + 1);
  const tUnitCell = ws.getCell(totalRow, UNIT_PRICE_COL);
  tUnitCell.fill = fill(C.WHITE);
  tUnitCell.border = borderOf(C.BLACK);

  // 금액 합계 (품목 표의 "금액" 열 그대로 합산 — 부가세 포함 금액)
  ws.mergeCells(totalRow, AMOUNT_COL, totalRow, AMOUNT_COL + 1);
  const tAmountCell = ws.getCell(totalRow, AMOUNT_COL);
  tAmountCell.value = grandTotal;
  tAmountCell.fill = fill(C.WHITE);
  tAmountCell.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: C.BLACK } };
  tAmountCell.alignment = { horizontal: "right", vertical: "middle" };
  tAmountCell.border = borderOf(C.BLACK);
  tAmountCell.numFmt = "#,##0";

  // 부가세 합계 (표시하지 않음)
  const tVatCell = ws.getCell(totalRow, VAT_COL);
  tVatCell.fill = fill(C.WHITE);
  tVatCell.font = { name: FONT_NAME, bold: true, size: 10, color: { argb: C.BLACK } };
  tVatCell.alignment = { horizontal: "right", vertical: "middle" };
  tVatCell.border = borderOf(C.BLACK);
  tVatCell.numFmt = "#,##0";

  // 적요: 공백
  const tRemCell = ws.getCell(totalRow, TOTAL_COLS);
  tRemCell.fill = fill(C.WHITE);
  tRemCell.border = borderOf(C.BLACK);
  ws.getRow(totalRow).height = 24;

  // ── 비고 섹션 (좌: "비고" 세로 병합 라벨, 우: 내용 — 원본과 동일한 좌우 배치) ─
  const remarksTopRow = totalRow + 1;
  const REMARKS_ROWS = 5;

  ws.mergeCells(remarksTopRow, 1, remarksTopRow + REMARKS_ROWS - 1, 1);
  const remLabel = ws.getCell(remarksTopRow, 1);
  remLabel.value = "비고";
  remLabel.fill = fill(C.WHITE);
  remLabel.font = { name: FONT_NAME, size: 10, color: { argb: C.BLACK } };
  remLabel.alignment = { horizontal: "center", vertical: "middle" };
  remLabel.border = borderOf(C.BLACK);

  ws.mergeCells(remarksTopRow, 2, remarksTopRow + REMARKS_ROWS - 1, TOTAL_COLS);
  const remContent = ws.getCell(remarksTopRow, 2);
  remContent.value = remarks || "해당사항 없음";
  remContent.fill = fill(C.WHITE);
  remContent.font = { name: FONT_NAME, size: 10, color: { argb: C.BLACK } };
  remContent.alignment = { horizontal: "left", vertical: "top", wrapText: true };
  remContent.border = borderOf(C.BLACK);
  for (let r = remarksTopRow; r < remarksTopRow + REMARKS_ROWS; r++) {
    ws.getRow(r).height = 20;
  }

  // ── 버퍼 반환 ─────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
