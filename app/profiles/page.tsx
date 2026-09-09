import { getProfilesByType } from "@/lib/db/profile-repo";
import { ProfileSection } from "@/components/profiles/profile-section";
import type { ProfileOption } from "@/lib/estimates/types";

export const metadata = { title: "공급자/고객 관리" };
export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  let providers: ProfileOption[] = [];
  let receivers: ProfileOption[] = [];
  let loadError = false;

  try {
    [providers, receivers] = await Promise.all([
      getProfilesByType("PROVIDER"),
      getProfilesByType("RECEIVER"),
    ]);
  } catch {
    loadError = true;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold">공급자/고객 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          견적서에 들어갈 공급자(우리 회사)와 공급받는자(고객/관공서) 정보를
          등록·수정합니다. 여기서 등록한 정보는 견적서 작성 화면의 드롭다운에
          바로 반영됩니다.
        </p>
      </div>

      {loadError ? (
        <p className="text-sm text-destructive">
          데이터를 불러오지 못했습니다. 환경 설정을 확인해주세요.
        </p>
      ) : (
        <>
          <ProfileSection
            type="PROVIDER"
            title="공급자"
            description="견적서 상단에 표시되는 우리 회사 정보입니다."
            initialProfiles={providers}
          />
          <ProfileSection
            type="RECEIVER"
            title="공급받는자"
            description="견적서를 받는 고객/관공서 정보입니다."
            initialProfiles={receivers}
          />
        </>
      )}
    </main>
  );
}
