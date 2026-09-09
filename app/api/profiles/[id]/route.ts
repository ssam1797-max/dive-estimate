import { NextResponse } from "next/server";
import { updateProfile, deleteProfile } from "@/lib/db/profile-repo";
import { profileSchema } from "@/lib/estimates/schema";

export const runtime = "nodejs";

/** PATCH /api/profiles/[id] - 프로필 정보 수정 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "JSON 형식의 요청이 필요합니다." },
        { status: 400 }
      );
    }

    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    const profile = await updateProfile(id, parsed.data);
    if (!profile) {
      return NextResponse.json(
        { error: "해당 프로필을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("프로필 수정 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}

/** DELETE /api/profiles/[id] - 프로필 삭제 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await deleteProfile(id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("프로필 삭제 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
