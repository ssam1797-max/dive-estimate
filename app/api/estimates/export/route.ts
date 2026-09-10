import { NextResponse } from "next/server";
import { exportEstimateSchema } from "@/lib/estimates/schema";
import { getProfileById, getDiscountPolicyMap } from "@/lib/estimates/pageData";
import {
  calculateDiscountRate,
  calculateEffectiveUnitPrice,
  calculateInclusiveVat,
  PRICE_TIER_LABELS,
} from "@/lib/estimates/pricing";
import {
  buildEstimateWorkbook,
  type WorkbookEstimateItem,
} from "@/lib/estimates/buildEstimateWorkbook";

/** POST /api/estimates/export - 견적서를 엑셀(.xlsx) 파일로 생성해 다운로드 응답으로 반환 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "요청 본문이 올바르지 않습니다." },
        { status: 400 }
      );
    }

    const parsed = exportEstimateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues.map((issue) => issue.message).join(" ") },
        { status: 400 }
      );
    }

    const { estimateNumber, date, providerId, receiverId, remarks, priceTier, referenceTiers, items } =
      parsed.data;

    const [provider, receiver, discountPolicies] = await Promise.all([
      getProfileById(providerId),
      getProfileById(receiverId),
      getDiscountPolicyMap(),
    ]);

    if (!provider) {
      return NextResponse.json(
        { error: "공급자 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    if (!receiver) {
      return NextResponse.json(
        { error: "공급받는자 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // priceRetail(소비자 정가)을 기준으로 서버 할인율 정책을 적용해 실제 단가를 재계산합니다.
    const workbookItems: WorkbookEstimateItem[] = items.map((item, index) => {
      const effectiveUnitPrice = calculateEffectiveUnitPrice(
        item.priceRetail,
        item.brand,
        priceTier,
        discountPolicies
      );
      const amount = effectiveUnitPrice * item.quantity;

      return {
        seq: index + 1,
        name: `${item.brand} ${item.name}`,
        spec: [item.color, item.size].filter(Boolean).join(" / ") || "-",
        unit: item.unit ?? "개",
        quantity: item.quantity,
        unitPrice: effectiveUnitPrice,
        amount,
        vat: calculateInclusiveVat(amount),
        itemRemarks: item.itemRemarks,
        discountRate: calculateDiscountRate(item.priceRetail, effectiveUnitPrice),
        referenceValues: referenceTiers.map((tier) =>
          calculateEffectiveUnitPrice(item.priceRetail, item.brand, tier, discountPolicies)
        ),
      };
    });

    const buffer = await buildEstimateWorkbook({
      estimateNumber,
      date,
      provider,
      receiver,
      remarks,
      priceTier,
      referenceTierLabels: referenceTiers.map((tier) => PRICE_TIER_LABELS[tier]),
      items: workbookItems,
    });

    const fileName = `견적서_${estimateNumber}.xlsx`;
    const encodedFileName = encodeURIComponent(fileName);

    // NextResponse의 BodyInit 타입 선언이 최신 TypeScript의 제네릭 TypedArray와
    // 어긋나 있어(Next.js/TS 라이브러리 타입 이슈) Buffer -> BodyInit 캐스팅이
    // 필요합니다. 런타임에는 표준 바이너리 응답 본문으로 정상 동작합니다.
    const responseBody = buffer as unknown as BodyInit;

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="estimate.xlsx"; filename*=UTF-8''${encodedFileName}`,
      },
    });
  } catch (error) {
    console.error("견적서 엑셀 다운로드 API 오류:", error);
    const message =
      error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
