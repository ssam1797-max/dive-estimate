import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalNav } from "@/components/layout/global-nav";
import { AdminModeProvider } from "@/components/layout/admin-mode-context";
import { NavigationLoadingOverlay } from "@/components/layout/navigation-loading-overlay";
import { getIsAdmin } from "@/lib/auth/admin-session";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "다이빙 장비 견적 시스템",
  description: "스마트 다이빙 장비 관리 및 멀티 가격 견적 시스템",
  // PWA/모바일 홈 화면 추가 시 쓰이는 아이콘·iOS 홈 화면 앱 이름 등.
  // manifest 는 app/manifest.ts 파일 컨벤션으로 Next.js 가 자동으로 연결한다.
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "다이빙 견적",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 노치가 있는 기기에서 배경색이 화면 끝까지 이어지도록. 확대/축소는
  // 접근성 때문에 일부러 막지 않는다(maximumScale/userScalable 미지정).
  viewportFit: "cover",
  themeColor: "#0C4A6E",
};

/**
 * 관리자 쿠키 조회(getIsAdmin)는 cookies() 를 읽는 런타임 데이터 접근이다.
 * 이걸 RootLayout 본문에서 직접 await 하면(예전 코드) "레이아웃이 런타임
 * 데이터에 접근하면 그 아래 라우트의 loading.tsx 가 폴백을 보여주지 못한다"
 * 는 Next.js의 공식 제약에 걸려, 페이지 이동 시 app/loading.tsx 스피너가
 * 전혀 뜨지 않는 원인이 된다. 이 컴포넌트로 분리해 자체 Suspense 경계
 * 안에 가둬야, {children} 쪽 라우트의 loading.tsx 가 레이아웃과 무관하게
 * 독립적으로 동작한다.
 */
async function AdminNavSection() {
  const isAdmin = await getIsAdmin();
  return (
    <AdminModeProvider isAdmin={isAdmin}>
      <GlobalNav />
    </AdminModeProvider>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense
          fallback={
            <AdminModeProvider isAdmin={false}>
              <GlobalNav />
            </AdminModeProvider>
          }
        >
          <AdminNavSection />
        </Suspense>
        {children}
        <NavigationLoadingOverlay />
      </body>
    </html>
  );
}
