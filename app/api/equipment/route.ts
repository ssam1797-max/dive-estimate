import { NextResponse } from "next/server";
import { insertEquipment } from "@/lib/db/equipment-repo";
import { equipmentCreateSchema } from "@/lib/equipment/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "JSON 형식의 요청이 필요합니다." },
        { status: 400 }
      );
    }

    const parsed = equipmentCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((i) => i.message).join(" ") },
        { status: 400 }
      );
    }

    const { brand, category, name, price_retail, colors, sizes, catalog_year } =
      parsed.data;

    try {
      const result = await insertEquipment({
        brand,
        category,
        name,
        price_retail,
        colors,
        sizes,
        catalog_year: catalog_year ?? null,
      });
      return NextResponse.json({ id: result.id }, { status: 201 });
    } catch (error) {
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
    console.error("장비 수동 등록 중 예외 발생:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json(
      { error: `서버 처리 중 오류가 발생했습니다: ${message}` },
      { status: 500 }
    );
  }
}
