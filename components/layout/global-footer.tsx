import * as React from "react";

/**
 * 모든 페이지 하단에 고정되는 사업자 정보 푸터. 순수 정적 텍스트라 상호작용이
 * 없어 서버 컴포넌트로 둔다("use client" 불필요).
 *
 * 각 줄은 "항목 | 항목" 형태인데, 사업자등록번호/통신판매업신고번호 줄처럼
 * 합쳐서 길어지는 조합이 있어 좁은 화면(휴대전화)에서 그대로 가로로
 * flex-wrap 하면 구분선(|)이 줄 끝에 혼자 남는 등 지저분해진다. sm(640px)
 * 미만에서는 구분선 없이 항목을 세로로 쌓고, sm 이상에서만 "|"로 이어 붙여
 * PC/모바일 양쪽에서 항상 깔끔하게 정렬되게 한다.
 */
function FooterLine({ items }: { items: React.ReactNode[] }) {
  return (
    <p className="flex flex-col items-center gap-0.5 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-2 sm:gap-y-1">
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            <span className="hidden text-border sm:inline" aria-hidden="true">
              |
            </span>
          )}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </p>
  );
}

export function GlobalFooter() {
  return (
    <footer className="border-t bg-background print:hidden">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-1.5 px-4 py-6 text-center text-xs text-muted-foreground sm:px-6">
        <FooterLine items={["상호명: 씨유(SEAU)", "대표자: 송태민"]} />
        <FooterLine
          items={["사업자등록번호: 472-01-01195", "통신판매업신고번호: 제 2018-고양일산동-1105호"]}
        />
        <FooterLine items={["주소: 경기도 일산동구 백석동 1199, 지층"]} />
        <FooterLine
          items={[
            "고객센터: 010-****-3923",
            <a key="email" href="mailto:aquascuba@naver.com" className="hover:text-foreground hover:underline">
              이메일: aquascuba@naver.com
            </a>,
          ]}
        />
        <p className="mt-1">Copyright © 씨유(SEAU). All rights reserved.</p>
      </div>
    </footer>
  );
}
