import type { MetadataRoute } from "next";

/**
 * Next.js App Router 의 manifest 파일 컨벤션 — 이 파일이 있으면 Next.js가
 * 자동으로 `/manifest.webmanifest` 로 서빙하고 <head> 에 링크 태그도 붙여준다
 * (layout.tsx 에서 따로 <link rel="manifest"> 를 추가할 필요 없음).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "다이빙 장비 견적 시스템",
    short_name: "다이빙 견적",
    description: "스마트 다이빙 장비 관리 및 멀티 가격 견적 시스템",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0C4A6E",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
