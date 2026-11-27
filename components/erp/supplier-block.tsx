import type { ProfileOption } from "@/lib/estimates/types";
import type { Partner } from "@/lib/erp/types";

/** 출력물 상단의 공급자 / 공급받는자 두 칸 */
export function PartiesBlock({ supplier, receiver }: { supplier: ProfileOption | null; receiver: Partner | null }) {
  const rows = (pairs: [string, string | null | undefined][]) =>
    pairs
      .filter(([, v]) => v)
      .map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <dt className="w-16 shrink-0 text-neutral-500">{k}</dt>
          <dd className="min-w-0">{v}</dd>
        </div>
      ));
  return (
    <div className="grid grid-cols-2 gap-4 text-[13px] leading-relaxed">
      <section className="rounded border border-neutral-300 p-3">
        <h3 className="mb-1 font-semibold">공급받는자</h3>
        <dl>
          {rows([
            ["상호", receiver?.name],
            ["사업자번호", receiver?.biz_no],
            ["대표자", receiver?.rep_name],
            ["주소", receiver?.address],
            ["연락처", receiver?.tel || receiver?.mobile],
          ])}
        </dl>
      </section>
      <section className="relative rounded border border-neutral-300 p-3">
        <h3 className="mb-1 font-semibold">공급자</h3>
        <dl>
          {rows([
            ["상호", supplier?.name],
            ["사업자번호", supplier?.businessNumber],
            ["대표자", supplier?.representative],
            ["업태/종목", [supplier?.businessType, supplier?.businessCategory].filter(Boolean).join(" / ")],
            ["주소", supplier?.address],
            ["연락처", supplier?.contact],
          ])}
        </dl>
        {supplier?.stampUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={supplier.stampUrl} alt="" className="absolute right-3 top-3 size-14 object-contain opacity-90" />
        )}
      </section>
    </div>
  );
}
