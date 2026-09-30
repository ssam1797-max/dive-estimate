import { EquipmentNav } from "@/components/equipment/equipment-nav";
import { getIsAdmin } from "@/lib/auth/admin-session";

export default async function EquipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isAdmin = await getIsAdmin();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <h1 className="text-2xl font-semibold">장비 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF 카탈로그를 업로드하거나, 장비를 직접 입력해서 마스터에 등록하세요.
        </p>
      </div>
      {isAdmin ? (
        <>
          <div className="mt-4 px-6 sm:px-8">
            <EquipmentNav />
          </div>
          <div className="p-6 sm:p-8">{children}</div>
        </>
      ) : (
        <div className="p-6 sm:p-8">
          <p className="rounded-md border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            장비 동기화/등록/수정은 관리자 모드에서만 이용할 수 있습니다. 상단
            &quot;관리자 모드&quot; 버튼으로 로그인해주세요.
          </p>
        </div>
      )}
    </div>
  );
}
