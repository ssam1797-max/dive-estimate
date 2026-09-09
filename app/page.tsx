import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">
          스마트 다이빙 장비 관리 및 멀티 가격 견적 시스템
        </h1>
        <p className="text-muted-foreground max-w-md text-sm">
          카탈로그 PDF를 AI로 자동 분석해 장비 마스터를 구축하고, 멀티 가격
          견적서를 손쉽게 작성하세요.
        </p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/equipment/import"
          className="flex flex-col gap-1 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
        >
          <span className="font-medium">장비 카탈로그 업로드</span>
          <span className="text-xs text-muted-foreground">
            브랜드 카탈로그 PDF를 AI가 자동 분석해 장비 마스터에 등록합니다.
          </span>
        </Link>
        <Link
          href="/estimates/new"
          className="flex flex-col gap-1 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
        >
          <span className="font-medium">견적서 작성</span>
          <span className="text-xs text-muted-foreground">
            장비를 선택하고 가격 정책을 적용해 Excel 견적서를 만듭니다.
          </span>
        </Link>
        <Link
          href="/discount-policies"
          className="flex flex-col gap-1 rounded-lg border p-4 text-left hover:bg-accent transition-colors"
        >
          <span className="font-medium">브랜드별 할인율 설정</span>
          <span className="text-xs text-muted-foreground">
            소비자가·샵가·공급가·원가 할인율을 브랜드별로 관리합니다.
          </span>
        </Link>
      </div>
    </main>
  );
}
