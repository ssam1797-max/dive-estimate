import "server-only";
import { getEstimateEditAuth } from "@/lib/db/estimate-repo";
import { getIsAdmin } from "@/lib/auth/admin-session";
import { verifyEstimatePassword } from "@/lib/estimates/estimatePassword";

export type EstimateAccessResult =
  | { ok: true }
  | { ok: false; status: 404 | 403; error: string };

/**
 * 견적서 수정(PUT)/삭제(DELETE)/비밀번호 확인(verify-password) 라우트가
 * 공통으로 쓰는 접근 제어. 관리자 모드면 무조건 통과하고, 그 외에는 저장
 * 시 설정한 비밀번호가 있을 때만 입력값을 대조한다 — 이 기능 추가 이전에
 * 저장돼 비밀번호가 아예 없는(레거시) 견적서는 계속 자유롭게 통과시킨다.
 */
export async function checkEstimateEditAccess(
  estimateId: string,
  providedPassword: string | undefined
): Promise<EstimateAccessResult> {
  const [auth, isAdmin] = await Promise.all([
    getEstimateEditAuth(estimateId),
    getIsAdmin(),
  ]);

  if (!auth) return { ok: false, status: 404, error: "견적서를 찾을 수 없습니다." };
  if (isAdmin) return { ok: true };
  if (!auth.editPasswordHash) return { ok: true };

  if (!providedPassword || !verifyEstimatePassword(providedPassword, auth.editPasswordHash)) {
    return { ok: false, status: 403, error: "비밀번호가 올바르지 않습니다." };
  }
  return { ok: true };
}
