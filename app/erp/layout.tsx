import { getIsAdmin } from "@/lib/auth/admin-session";
import { isMockMode } from "@/lib/db/is-mock";
import { ErpSubnav } from "@/components/erp/erp-subnav";

export const metadata = { title: "장부(ERP)" };
export const dynamic = "force-dynamic";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const isAdmin = await getIsAdmin();
  if (!isAdmin) {
    return (
      <main className="mx-auto w-full max-w-xl p-8">
        <h1 className="text-2xl font-semibold">장부(ERP)</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          장부는 관리자만 볼 수 있어요. 화면 오른쪽 위의 관리자 모드 버튼으로 먼저 로그인해주세요.
        </p>
      </main>
    );
  }
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <ErpSubnav />
      {isMockMode() && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 print:hidden dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <strong>Mock 모드</strong> — 예시 데이터입니다. 서버가 다시 시작되면 입력한 내용이 사라집니다.
        </div>
      )}
      {children}
    </div>
  );
}
