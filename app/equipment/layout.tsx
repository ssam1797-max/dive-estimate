import { EquipmentNav } from "@/components/equipment/equipment-nav";

export default function EquipmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <div className="px-6 pt-6 sm:px-8 sm:pt-8">
        <h1 className="text-2xl font-semibold">장비 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PDF 카탈로그를 업로드하거나, 장비를 직접 입력해서 마스터에 등록하세요.
        </p>
      </div>
      <div className="mt-4 px-6 sm:px-8">
        <EquipmentNav />
      </div>
      <div className="p-6 sm:p-8">{children}</div>
    </div>
  );
}
