import { NextResponse } from "next/server";
import { reconcileSoldOutStatus } from "@/lib/db/equipment-repo";
import { requireAdminOrCronSecret } from "@/lib/auth/admin-session";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ReconcileInput {
  catalogYear: number;
  seenKeys: { brand: string; name: string }[];
}

function isValidInput(value: unknown): value is ReconcileInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.catalogYear !== "number" || !Array.isArray(v.seenKeys)) return false;
  return v.seenKeys.every(
    (k) =>
      typeof k === "object" &&
      k !== null &&
      typeof (k as Record<string, unknown>).brand === "string" &&
      typeof (k as Record<string, unknown>).name === "string"
  );
}

/**
 * 퐁당닷컴 전체 동기화(모든 카테고리 × 모든 페이지)가 끝난 뒤 1번만
 * 호출된다 — 이번 동기화에서 한 번이라도 발견된 (브랜드,품명) 키 전체를
 * 받아, DB에는 있지만 이번에 안 보인 자동 동기화 품목은 품절(is_sold_out
 * =true)로, 품절이었다가 다시 보인 품목은 재입고(false)로 되돌린다
 * (lib/db/equipment-repo.ts reconcileSoldOutStatus 참고).
 */
export async function POST(request: Request) {
  const denied = await requireAdminOrCronSecret(request);
  if (denied) return denied;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    if (!isValidInput(body)) {
      return NextResponse.json(
        { error: "catalogYear(number)와 seenKeys({brand, name}[])가 필요합니다." },
        { status: 400 }
      );
    }

    const result = await reconcileSoldOutStatus(body.catalogYear, body.seenKeys);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("품절/재입고 반영 중 예외 발생:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
