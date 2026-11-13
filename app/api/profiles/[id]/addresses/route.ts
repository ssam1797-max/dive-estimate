import { NextResponse } from "next/server";
import {
  createProfileAddress,
  getAddressesByProfile,
  ProfileNotFoundError,
} from "@/lib/db/profile-address-repo";
import { profileAddressSchema } from "@/lib/estimates/schema";

export const runtime = "nodejs";

/** GET /api/profiles/[id]/addresses - 공급받는자 주소록(배송지 목록) 조회 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const addresses = await getAddressesByProfile(id);
    return NextResponse.json({ addresses }, { status: 200 });
  } catch (error) {
    console.error("주소록 조회 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `주소록을 불러오지 못했습니다: ${message}` },
      { status: 500 }
    );
  }
}

/** POST /api/profiles/[id]/addresses - 주소록에 배송지 추가 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "JSON 형식의 요청이 필요합니다." }, { status: 400 });
    }

    const parsed = profileAddressSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    const address = await createProfileAddress(id, parsed.data);
    return NextResponse.json({ address }, { status: 201 });
  } catch (error) {
    if (error instanceof ProfileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("주소록 등록 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `배송지 등록 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
