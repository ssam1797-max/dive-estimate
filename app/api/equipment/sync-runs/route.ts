import { NextResponse } from "next/server";
import { createSyncRun } from "@/lib/db/equipment-repo";
import { requireAdmin } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

interface SyncRunInput {
  source: string;
  startedAt: string;
  finishedAt: string;
  status: "success" | "error";
  totalParsed: number;
  insertedCount: number;
  updatedCount: number;
  protectedCount: number;
  failedCount: number;
  distinctBrandCount: number;
  distinctCategoryCount: number;
  message: string | null;
}

function isValidInput(value: unknown): value is SyncRunInput {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.source === "string" &&
    typeof v.startedAt === "string" &&
    typeof v.finishedAt === "string" &&
    (v.status === "success" || v.status === "error") &&
    typeof v.totalParsed === "number" &&
    typeof v.insertedCount === "number" &&
    typeof v.updatedCount === "number" &&
    typeof v.protectedCount === "number" &&
    typeof v.failedCount === "number" &&
    typeof v.distinctBrandCount === "number" &&
    typeof v.distinctCategoryCount === "number" &&
    (v.message === null || typeof v.message === "string")
  );
}

/**
 * 퐁당닷컴 동기화가 끝날 때(성공/실패 모두) 1번 호출되어 "데이터 동기화
 * 현황" 카드/실행 로그에 쓸 기록을 1건 남긴다. 카테고리×페이지 단위로
 * 나뉘어 호출되는 동기화 자체(usePongdangChunkedSync)와는 별개로, 그
 * 전체가 끝난 뒤에만 호출된다.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    if (!isValidInput(body)) {
      return NextResponse.json({ error: "동기화 실행 기록 형식이 올바르지 않습니다." }, { status: 400 });
    }

    await createSyncRun(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("동기화 실행 기록 저장 중 예외 발생:", error);
    const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
