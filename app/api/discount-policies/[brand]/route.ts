import { NextResponse } from "next/server";
import { deleteDiscountPolicy } from "@/lib/db/discount-policy-repo";
import { requireAdmin } from "@/lib/auth/admin-session";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ brand: string }> }
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const { brand } = await params;
    await deleteDiscountPolicy(decodeURIComponent(brand));
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알 수 없는 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
