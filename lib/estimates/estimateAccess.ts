import "server-only";
import { getEstimateEditAuth } from "@/lib/db/estimate-repo";
import { getIsAdmin } from "@/lib/auth/admin-session";
import { verifyEstimatePassword } from "@/lib/estimates/estimatePassword";

export type EstimateAccessResult =
  | { ok: true }
  | { ok: false; status: 404 | 403; error: string };

/**
 * 견적서 수정(PUT)/삭제(DELETE)/비밀번호 확인(verify-password) 라우트가
 * 공통으로 쓰는 접근 제어. 관리자 모드면 무조건 통과한다. 그 외에는 저장
 * 시 설정한 비밀번호가 있으면 입력값을 대조하고, 비밀번호 기능 도입 이전에
 * 저장돼 비밀번호가 아예 없는(레거시) 견적서는 — 대조할 비밀번호 자체가
 * 없으므로 — 관리자 모드가 아니면 무조건 거절한다(관리자 전용 수정/삭제).
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

  if (!auth.editPasswordHash) {
    return {
      ok: false,
      status: 403,
      error: "비밀번호가 설정되지 않은 견적서입니다. 관리자 모드에서만 수정/삭제할 수 있습니다.",
    };
  }

  if (!providedPassword || !verifyEstimatePassword(providedPassword, auth.editPasswordHash)) {
    return { ok: false, status: 403, error: "비밀번호가 올바르지 않습니다." };
  }
  return { ok: true };
}
