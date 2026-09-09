import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GlobalNav } from "@/components/layout/global-nav";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GlobalNav />
        {children}
      </body>
    </html>
  );
}
