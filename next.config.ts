import type { NextConfig } from "next";
import { MAX_PDF_FILE_SIZE_BYTES } from "./lib/equipment/constants";

const nextConfig: NextConfig = {
  // pdf-parse 는 네이티브 의존성(@napi-rs/canvas)을 포함하고 있어
  // 서버 번들에 포함시키지 않고 그대로 require 하도록 제외합니다.
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    // proxy.ts(구 middleware.ts)가 모든 요청 본문을 메모리에 버퍼링할 때
    // 적용하는 기본 상한(10MB)이 카탈로그 PDF 업로드(최대 100MB)보다 작아서,
    // 큰 파일은 본문이 잘린 채로 전달되어 route handler 의 request.formData()
    // 파싱이 깨지는 문제가 있었습니다. 업로드 허용 용량에 여유분(1MB, 멀티파트
    // 경계/필드 오버헤드)을 더해 맞춰줍니다.
    proxyClientMaxBodySize: MAX_PDF_FILE_SIZE_BYTES + 1024 * 1024,
  },
};

export default nextConfig;
