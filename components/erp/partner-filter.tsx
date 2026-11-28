"use client";

import * as React from "react";

import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

/**
 * 전표 찾기의 거래처 칸: 이름(초성)·대표자·담당자·전화로 검색해서 고르면 바로 조회한다.
 * 값은 숨은 input(name="partner")으로 GET 폼에 실린다.
 */
export function PartnerFilter({ options, defaultValue }: { options: ComboboxOption[]; defaultValue: string }) {
  const [value, setValue] = React.useState(defaultValue);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const all: ComboboxOption[] = React.useMemo(() => [{ value: "", label: "전체" }, ...options], [options]);

  return (
    <>
      <input ref={inputRef} type="hidden" name="partner" value={value} />
      <Combobox
        options={all}
        value={value}
        placeholder="전체"
        searchPlaceholder="거래처 검색 (초성 가능)"
        className="w-56"
        onChange={(v) => {
          setValue(v);
          // 상태가 숨은 input 에 반영된 다음 폼을 보낸다
          requestAnimationFrame(() => inputRef.current?.form?.requestSubmit());
        }}
      />
    </>
  );
}
