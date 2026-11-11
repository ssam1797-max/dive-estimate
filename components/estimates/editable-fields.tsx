"use client";

import * as React from "react";

import { formatSignedWonDraft, parseSignedWon } from "@/lib/estimates/pricing";

/**
 * 저장된 견적서를 관리자가 바로 고칠 때 쓰는 입력란 모음. 견적서 문서 표
 * (estimate-document-table.tsx)의 인라인 셀과 모바일용 품목 수정 카드
 * (estimate-item-edit-cards.tsx)가 같은 입력 동작을 공유하도록 분리했다 —
 * 겉모습(크기·정렬·테두리)은 호출부가 className 으로 정한다.
 *
 * 공통 규칙: 입력 중에는 친 글자를 그대로(draft) 들고 있다가, 입력을 마치면
 * (포커스 이탈/Enter) 확정한다.
 */

function fmtNum(value: number): string {
  return Math.round(value).toLocaleString("ko-KR");
}

function blurOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}

/**
 * 단가/금액 입력란. value 를 항상 숫자에서 다시 그리면 "-" 만 친 순간 0 으로
 * 바뀌어 음수(할인 금액)를 입력할 수 없으므로 draft 문자열을 따로 둔다.
 *
 * type="number" 대신 type="text" 를 쓴다 — Safari(맥OS/iOS)의 number input은
 * 입력 중간값을 엄격하게 검증하다가 값이 빈 문자열로 리셋되는 경우가 있다.
 * inputMode="numeric" 도 쓰지 않는다 — iOS 숫자 키패드에는 "-" 가 없다.
 */
export function EditableMoneyInput({
  value,
  label,
  className,
  onChange,
  onCommit,
}: {
  value: number;
  label: string;
  className?: string;
  onChange: (value: number) => void;
  onCommit?: () => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);

  return (
    <input
      type="text"
      className={className}
      value={draft ?? fmtNum(value)}
      onFocus={() => setDraft(fmtNum(value))}
      onBlur={() => {
        setDraft(null);
        onCommit?.();
      }}
      onKeyDown={blurOnEnter}
      onChange={(event) => {
        const next = formatSignedWonDraft(event.target.value);
        setDraft(next);
        onChange(parseSignedWon(next));
      }}
      aria-label={label}
    />
  );
}

/**
 * 수량 입력란. 입력을 마치면 1 이상의 정수로 정리해 값이 바뀐 경우에만
 * onCommit 을 호출한다(비우거나 0을 넣으면 원래 수량으로 되돌아간다 —
 * 수량 0은 저장할 수 없다). 모바일에서는 숫자 키패드가 뜬다.
 */
export function EditableQuantityInput({
  value,
  label,
  className,
  onCommit,
}: {
  value: number;
  label: string;
  className?: string;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      value={draft ?? String(value)}
      onFocus={(event) => {
        setDraft(String(value));
        event.currentTarget.select();
      }}
      onBlur={() => {
        const next = Math.floor(Number(draft));
        setDraft(null);
        if (draft !== null && Number.isFinite(next) && next >= 1 && next !== value) {
          onCommit(next);
        }
      }}
      onKeyDown={blurOnEnter}
      onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
      aria-label={label}
    />
  );
}

/**
 * 옵션(색상 또는 사이즈) 입력란. 장비 마스터에 등록된 옵션이 있으면
 * <datalist> 로 후보를 띄워 고를 수 있고, 목록에 없는 값도 그대로 칠 수 있다.
 * 입력을 마쳤을 때 값이 바뀐 경우에만 onCommit 을 호출한다.
 */
export function EditableOptionInput({
  value,
  label,
  placeholder,
  options,
  className,
  onCommit,
}: {
  value: string;
  label: string;
  placeholder: string;
  options?: string[];
  className?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState<string | null>(null);
  const listId = React.useId();
  const hasOptions = !!options && options.length > 0;

  return (
    <>
      <input
        type="text"
        className={className}
        value={draft ?? value}
        placeholder={placeholder}
        list={hasOptions ? listId : undefined}
        onFocus={() => setDraft(value)}
        onBlur={() => {
          const next = (draft ?? value).trim();
          setDraft(null);
          if (next !== value) onCommit(next);
        }}
        onKeyDown={blurOnEnter}
        onChange={(event) => setDraft(event.target.value)}
        aria-label={label}
      />
      {hasOptions && (
        <datalist id={listId}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </>
  );
}
