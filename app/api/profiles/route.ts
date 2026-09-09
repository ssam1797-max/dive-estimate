import { NextResponse } from "next/server";
import { getProfilesByType, createProfile } from "@/lib/db/profile-repo";
import { profileSchema } from "@/lib/estimates/schema";

/** GET /api/profiles?type=PROVIDER|RECEIVER - 프로필 목록 조회 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    if (type !== "PROVIDER" && type !== "RECEIVER") {
      return NextResponse.json(
        { error: "type 쿼리 파라미터는 PROVIDER 또는 RECEIVER 여야 합니다." },
        { status: 400 }
      );
    }

    const profiles = await getProfilesByType(type);
    return NextResponse.json({ profiles }, { status: 200 });
  } catch (error) {
    console.error("프로필 목록 조회 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}

/** POST /api/profiles - 공급자/공급받는자 프로필 신규 등록 */
export async function POST(request: Request) {
  try {
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

    const profile = await createProfile(parsed.data);
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    console.error("프로필 등록 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
