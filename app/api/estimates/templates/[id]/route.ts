import { NextResponse } from "next/server";
import {
  getTemplateWithItems,
  deleteTemplate,
  renameTemplate,
} from "@/lib/estimates/templateQueries";

/** GET /api/estimates/templates/[id] - 템플릿 상세(항목 포함) 조회 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const template = await getTemplateWithItems(id);

    if (!template) {
      return NextResponse.json(
        { error: "템플릿을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ template }, { status: 200 });
  } catch (error) {
    console.error("템플릿 상세 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/estimates/templates/[id] - 템플릿 1건 삭제 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteTemplate(id);

    if (!deleted) {
      return NextResponse.json(
        { error: "템플릿을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("템플릿 삭제 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/estimates/templates/[id] - 템플릿 이름 변경 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const templateName = typeof body?.templateName === "string" ? body.templateName.trim() : "";

    if (!templateName) {
      return NextResponse.json(
        { error: "템플릿 이름을 입력해주세요." },
        { status: 400 }
      );
    }

    const renamed = await renameTemplate(id, templateName);

    if (!renamed) {
      return NextResponse.json(
        { error: "템플릿을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, templateName }, { status: 200 });
  } catch (error) {
    console.error("템플릿 이름 변경 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
