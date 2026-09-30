"use client";

import * as React from "react";

const AdminModeContext = React.createContext(false);

/**
 * 서버(RootLayout)에서 쿠키로 확인한 관리자 모드 여부를 하위 클라이언트
 * 컴포넌트 전체에 전달한다. 로그인/로그아웃 후에는 router.refresh() 로
 * RootLayout 을 다시 실행시켜 이 값을 갱신한다(별도 클라이언트 상태 없음).
 */
export function AdminModeProvider({
  isAdmin,
  children,
}: {
  isAdmin: boolean;
  children: React.ReactNode;
}) {
  return (
    <AdminModeContext.Provider value={isAdmin}>{children}</AdminModeContext.Provider>
  );
}

export function useAdminMode(): boolean {
  return React.useContext(AdminModeContext);
}
