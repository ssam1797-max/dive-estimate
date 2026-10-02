"use client";

import * as React from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BankAccountSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

export function BankAccountForm({
  initialSettings,
}: {
  initialSettings: BankAccountSettings;
}) {
  const [bankName, setBankName] = React.useState(initialSettings.bankName);
  const [accountNumber, setAccountNumber] = React.useState(initialSettings.accountNumber);
  const [accountHolder, setAccountHolder] = React.useState(initialSettings.accountHolder);
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSaved(false);
    try {
      const response = await fetch("/api/settings/bank-account", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountNumber, accountHolder }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error ?? "저장에 실패했습니다.");
      }
      setSaved(true);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>입금 계좌 정보</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-name">은행명</Label>
            <Input
              id="bank-name"
              value={bankName}
              disabled={isSaving}
              onChange={(event) => {
                setBankName(event.target.value);
                setSaved(false);
              }}
              placeholder="예: 국민은행"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-number">계좌번호</Label>
            <Input
              id="bank-account-number"
              value={accountNumber}
              disabled={isSaving}
              onChange={(event) => {
                setAccountNumber(event.target.value);
                setSaved(false);
              }}
              placeholder="예: 123456-78-901234"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bank-account-holder">예금주</Label>
            <Input
              id="bank-account-holder"
              value={accountHolder}
              disabled={isSaving}
              onChange={(event) => {
                setAccountHolder(event.target.value);
                setSaved(false);
              }}
              placeholder="예: 홍길동"
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-3">
          <Button type="button" onClick={handleSave} disabled={isSaving} className="self-start">
            {isSaving && <Loader2 className="animate-spin" />}
            저장
          </Button>
          {saved && (
            <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4" />
              저장되었습니다.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
