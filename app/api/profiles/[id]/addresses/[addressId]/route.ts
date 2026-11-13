import { NextResponse } from "next/server";
import { deleteProfileAddress, updateProfileAddress } from "@/lib/db/profile-address-repo";
import { profileAddressSchema } from "@/lib/estimates/schema";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string; addressId: string }> };

/** PATCH /api/profiles/[id]/addresses/[addressId] - 배송지 수정 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id, addressId } = await params;
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

    const address = await updateProfileAddress(id, addressId, parsed.data);
    if (!address) {
      return NextResponse.json({ error: "해당 배송지를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ address }, { status: 200 });
  } catch (error) {
    console.error("주소록 수정 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `배송지 수정 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}

/** DELETE /api/profiles/[id]/addresses/[addressId] - 배송지 삭제 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id, addressId } = await params;
    const deleted = await deleteProfileAddress(id, addressId);
    if (!deleted) {
      return NextResponse.json({ error: "해당 배송지를 찾을 수 없습니다." }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("주소록 삭제 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `배송지 삭제 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
