import "server-only";
import { isMockMode } from "@/lib/db/is-mock";
import { mockStore } from "@/lib/db/mock-store";

export interface BankAccountSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

const EMPTY_BANK_ACCOUNT: BankAccountSettings = {
  bankName: "",
  accountNumber: "",
  accountHolder: "",
};

/**
 * 구매요청 주문 완료 화면에 보여줄 입금 계좌 정보. 관리자가 한 번도 설정한
 * 적이 없으면(싱글턴 행이 아직 없으면) 빈 값으로 돌려준다 — 화면 쪽에서
 * "계좌 정보가 아직 등록되지 않았습니다"로 처리한다.
 */
export async function getBankAccountSettings(): Promise<BankAccountSettings> {
  if (isMockMode()) {
    return mockStore.bankAccount ?? EMPTY_BANK_ACCOUNT;
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("bank_account_settings")
    .select("bank_name, account_number, account_holder")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return EMPTY_BANK_ACCOUNT;
  return {
    bankName: data.bank_name ?? "",
    accountNumber: data.account_number ?? "",
    accountHolder: data.account_holder ?? "",
  };
}

export async function updateBankAccountSettings(
  input: BankAccountSettings
): Promise<BankAccountSettings> {
  if (isMockMode()) {
    mockStore.bankAccount = { ...input };
    return { ...input };
  }
  const { createAdminClient } = await import("@/lib/supabase/server");
  const supabase = await createAdminClient();
  const { error } = await supabase.from("bank_account_settings").upsert({
    id: true,
    bank_name: input.bankName,
    account_number: input.accountNumber,
    account_holder: input.accountHolder,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  return { ...input };
}
