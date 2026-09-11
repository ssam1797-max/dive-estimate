import { NextResponse } from "next/server";
import {
  getEquipmentById,
  updateEquipment,
  deleteEquipment,
} from "@/lib/db/equipment-repo";
import { equipmentUpdateSchema } from "@/lib/equipment/schema";

export const runtime = "nodejs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const item = await getEquipmentById(id);
    if (!item) {
      return NextResponse.json({ error: "장비를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(item);
  } catch (error) {
    console.error("장비 단건 조회 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "JSON 형식의 요청이 필요합니다." },
        { status: 400 }
      );
    }

    const parsed = equipmentUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        { status: 400 }
      );
    }

    const { brand, category, name, price_retail, colors, sizes, catalog_year } =
      parsed.data;

    try {
      await updateEquipment(id, {
        brand,
        category,
        name,
        price_retail,
        colors,
        sizes,
        catalog_year: catalog_year ?? null,
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      if ((error as Error & { code?: string })?.code === "NOT_FOUND") {
        return NextResponse.json({ error: "장비를 찾을 수 없습니다." }, { status: 404 });
      }
      if (error instanceof Error && (error as Error & { code?: string }).code === "23505") {
        return NextResponse.json(
          {
            error: `같은 브랜드·연도·모델명의 장비가 이미 등록되어 있습니다. (${brand} / ${catalog_year ?? "-"}년 / ${name})`,
          },
          { status: 409 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("장비 수정 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const deleted = await deleteEquipment(id);
    if (!deleted) {
      return NextResponse.json({ error: "장비를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("장비 삭제 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
