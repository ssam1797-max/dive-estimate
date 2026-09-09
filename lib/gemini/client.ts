import "server-only";
import { GoogleGenAI } from "@google/genai";

let cachedClient: GoogleGenAI | null = null;

/**
 * Gemini Developer API 클라이언트를 생성합니다. 서버 전용입니다.
 * GEMINI_API_KEY 는 절대 클라이언트(브라우저)에 노출되지 않아야 합니다.
 */
export function getGeminiClient(): GoogleGenAI {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인해주세요."
    );
  }

  cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}
