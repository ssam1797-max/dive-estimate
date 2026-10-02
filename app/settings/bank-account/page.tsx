import { getBankAccountSettings } from "@/lib/db/settings-repo";
import { getIsAdmin } from "@/lib/auth/admin-session";
import { BankAccountForm } from "@/components/settings/bank-account-form";

export const metadata = { title: "입금 계좌 설정" };
export const dynamic = "force-dynamic";

export default async function BankAccountSettingsPage() {
  const isAdmin = await getIsAdmin();
  let initialSettings = { bankName: "", accountNumber: "", accountHolder: "" };
  let loadError = false;

  if (isAdmin) {
    try {
      initialSettings = await getBankAccountSettings();
    } catch {
      loadError = true;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">입금 계좌 설정</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          여기에 등록한 계좌 정보는 고객이 [장바구니에서 구매요청]을 완료했을 때
          뜨는 주문 완료 화면에 그대로 표시됩니다.
        </p>
      </div>

      {!isAdmin ? (
        <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          입금 계좌 설정은 관리자 모드에서만 이용할 수 있습니다. 상단
          &quot;관리자 모드&quot; 버튼으로 로그인해주세요.
        </p>
      ) : loadError ? (
        <p className="text-sm text-destructive">
          데이터를 불러오지 못했습니다. 환경 설정을 확인해주세요.
        </p>
      ) : (
        <BankAccountForm initialSettings={initialSettings} />
      )}
    </main>
  );
}
