"use client";

import * as React from "react";
import { Loader2, Plus, RefreshCw, X } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import type { ProfileOption } from "@/lib/estimates/types";

const NEW_RECEIVER_VALUE = "__new_receiver__";

interface BasicInfoSectionProps {
  date: string;
  onDateChange: (date: string) => void;

  estimateNumber: string;
  isEstimateNumberLoading: boolean;
  estimateNumberError: string | null;
  onRetryEstimateNumber: () => void;

  providers: ProfileOption[];
  providerId: string;
  onProviderChange: (providerId: string) => void;

  receivers: ProfileOption[];
  receiverId: string;
  onReceiverChange: (receiverId: string) => void;
  /** 목록에 없는 공급받는자를 그 자리에서 등록. 성공 시 생성된 프로필을 반환한다. */
  onCreateReceiver: (name: string) => Promise<ProfileOption>;

  remarks: string;
  onRemarksChange: (remarks: string) => void;

  disabled?: boolean;
}

export function BasicInfoSection({
  date,
  onDateChange,
  estimateNumber,
  isEstimateNumberLoading,
  estimateNumberError,
  onRetryEstimateNumber,
  providers,
  providerId,
  onProviderChange,
  receivers,
  receiverId,
  onReceiverChange,
  onCreateReceiver,
  remarks,
  onRemarksChange,
  disabled,
}: BasicInfoSectionProps) {
  const [isAddingReceiver, setIsAddingReceiver] = React.useState(false);
  const [newReceiverName, setNewReceiverName] = React.useState("");
  const [isCreatingReceiver, setIsCreatingReceiver] = React.useState(false);
  const [createReceiverError, setCreateReceiverError] = React.useState<string | null>(
    null
  );

  const startAddingReceiver = () => {
    setNewReceiverName("");
    setCreateReceiverError(null);
    setIsAddingReceiver(true);
  };

  const cancelAddingReceiver = () => {
    setIsAddingReceiver(false);
    setCreateReceiverError(null);
  };

  const handleCreateReceiver = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newReceiverName.trim()) {
      setCreateReceiverError("이름(상호)을 입력해주세요.");
      return;
    }

    setIsCreatingReceiver(true);
    setCreateReceiverError(null);
    try {
      const created = await onCreateReceiver(newReceiverName.trim());
      onReceiverChange(created.id);
      setIsAddingReceiver(false);
    } catch (error) {
      setCreateReceiverError(
        error instanceof Error ? error.message : "등록 중 오류가 발생했습니다."
      );
    } finally {
      setIsCreatingReceiver(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>기본 정보</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label>발행일</Label>
            <Calendar
              value={date}
              onChange={onDateChange}
              disabled={disabled}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="estimate-number">견적서 번호</Label>
            <div className="flex items-center gap-2">
              <Input
                id="estimate-number"
                readOnly
                value={
                  isEstimateNumberLoading ? "생성 중..." : estimateNumber || "-"
                }
                className="bg-muted"
              />
              {isEstimateNumberLoading ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled}
                  onClick={onRetryEstimateNumber}
                  aria-label="견적서 번호 다시 생성"
                >
                  <RefreshCw className="size-4" />
                </Button>
              )}
            </div>
            {estimateNumberError && (
              <p className="text-xs text-destructive">{estimateNumberError}</p>
            )}
            <p className="text-xs text-muted-foreground">
              날짜를 기준으로 YYMMDD-순번 형식으로 자동 생성됩니다.
            </p>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="provider-select">공급자</Label>
            <Select
              id="provider-select"
              value={providerId}
              disabled={disabled}
              onChange={(event) => onProviderChange(event.target.value)}
            >
              <option value="" disabled>
                {providers.length === 0
                  ? "등록된 공급자가 없습니다"
                  : "공급자를 선택하세요"}
              </option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                  {provider.contact ? ` · ${provider.contact}` : ""}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="receiver-select">공급받는자</Label>
            {isAddingReceiver ? (
              <form className="flex flex-col gap-1.5" onSubmit={handleCreateReceiver}>
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newReceiverName}
                    disabled={isCreatingReceiver}
                    placeholder="예: 보성소방서"
                    onChange={(event) => setNewReceiverName(event.target.value)}
                  />
                  <Button type="submit" size="icon" disabled={isCreatingReceiver}>
                    {isCreatingReceiver ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={isCreatingReceiver}
                    onClick={cancelAddingReceiver}
                    aria-label="새 공급받는자 등록 취소"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
                {createReceiverError && (
                  <p className="text-xs text-destructive">{createReceiverError}</p>
                )}
              </form>
            ) : (
              <Select
                id="receiver-select"
                value={receiverId}
                disabled={disabled}
                onChange={(event) => {
                  if (event.target.value === NEW_RECEIVER_VALUE) {
                    startAddingReceiver();
                    return;
                  }
                  onReceiverChange(event.target.value);
                }}
              >
                <option value="" disabled>
                  {receivers.length === 0
                    ? "등록된 수신자가 없습니다"
                    : "공급받는자를 선택하세요"}
                </option>
                {receivers.map((receiver) => (
                  <option key={receiver.id} value={receiver.id}>
                    {receiver.name}
                    {receiver.contact ? ` · ${receiver.contact}` : ""}
                  </option>
                ))}
                <option value={NEW_RECEIVER_VALUE}>+ 새로 입력 및 등록...</option>
              </Select>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="estimate-remarks">비고</Label>
          <Textarea
            id="estimate-remarks"
            value={remarks}
            disabled={disabled}
            placeholder="견적서 전체에 대한 비고를 입력하세요 (선택)"
            onChange={(event) => onRemarksChange(event.target.value)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
