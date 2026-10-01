import "server-only";
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";

export { ESTIMATE_PASSWORD_REGEX } from "@/lib/estimates/estimatePasswordRules";

const KEY_LENGTH = 32;

/** "salt:hash" 형식 문자열로 저장한다 — 비밀번호 자체는 절대 평문으로 저장하지 않는다. */
export function hashEstimatePassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

/** 입력한 비밀번호가 저장된 해시와 일치하는지 타이밍 공격에 안전하게 비교한다. */
export function verifyEstimatePassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);
  if (expected.length !== actual.length) return false;

  return timingSafeEqual(expected, actual);
}
