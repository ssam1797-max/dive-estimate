import { Loader2 } from "lucide-react";

/**
 * 페이지 이동 시 Next.js 가 자동으로 보여주는 로딩 화면(App Router의
 * loading.tsx 컨벤션). 이 앱은 대부분의 페이지가 서버 컴포넌트에서 매번
 * DB를 새로 조회하므로(캐시하면 재고/가격 등이 오래된 값으로 보일 수 있어
 * 의도적으로 force-dynamic), 조회가 끝날 때까지 화면이 잠깐 하얗게
 * 비어있는 것처럼 보였다 — 로딩 중인지 멈춘 것인지 구분이 안 된다는
 * 피드백에 따라, 그 대기 시간 동안 항상 이 스피너를 보여준다.
 *
 * 루트(app/)에 하나만 둬도 모든 하위 라우트 이동에 공통으로 적용된다 —
 * GlobalNav 는 이 파일과 무관한 상위 레이아웃에 있어 이동 중에도 계속
 * 보이고 클릭 가능하다.
 */
export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">불러오는 중...</p>
    </div>
  );
}
