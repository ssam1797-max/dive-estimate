"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfileAddressFormValues } from "@/hooks/use-profile-addresses";
import type { ProfileAddress } from "@/lib/estimates/types";

interface AddressFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 수정 대상. null 이면 신규 등록. */
  editingAddress: ProfileAddress | null;
  /** 실패하면 예외를 던진다 — 폼이 메시지를 보여주고 열린 상태를 유지한다. */
  onSubmit: (values: ProfileAddressFormValues) => Promise<void>;
  /** 공급받는자 이름 — 안내 문구에 표시. */
  profileName?: string;
}

function toFormValues(address: ProfileAddress | null): ProfileAddressFormValues {
  return {
    label: address?.label ?? "",
    recipientName: address?.recipientName ?? "",
    contact: address?.contact ?? "",
    address: address?.address ?? "",
    memo: address?.memo ?? "",
  };
}

function AddressForm({
  editingAddress,
  onOpenChange,
  onSubmit,
  profileName,
}: Omit<AddressFormDialogProps, "open">) {
  const [values, setValues] = React.useState<ProfileAddressFormValues>(() =>
    toFormValues(editingAddress)
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = <K extends keyof ProfileAddressFormValues>(key: K, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();

    if (!values.recipientName.trim()) {
      setError("받는사람 이름을 입력해주세요.");
      return;
    }
    if (!values.address.trim()) {
      setError("배송 주소를 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "저장 중 오류가 발생했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editingAddress ? "배송지 수정" : "새 배송지 등록"}</DialogTitle>
        <DialogDescription>
          {profileName ? `${profileName}의 주소록에 저장됩니다. ` : ""}
          강사님이 발주한 장비를 고객에게 바로 보낼 때 받는사람 정보로 사용합니다.
        </DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="address-recipient-name">받는사람 *</Label>
            <Input
              id="address-recipient-name"
              autoFocus
              value={values.recipientName}
              disabled={isSaving}
              placeholder="예: 홍길동"
              onChange={(event) => set("recipientName", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address-contact">연락처</Label>
            <Input
              id="address-contact"
              type="tel"
              inputMode="tel"
              value={values.contact}
              disabled={isSaving}
              placeholder="예: 010-1234-5678"
              onChange={(event) => set("contact", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="address-address">주소 *</Label>
            <Input
              id="address-address"
              value={values.address}
              disabled={isSaving}
              placeholder="예: 광주광역시 서구 금화로 278 101동 1001호"
              onChange={(event) => set("address", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address-label">구분 이름</Label>
            <Input
              id="address-label"
              value={values.label}
              disabled={isSaving}
              placeholder="예: 홍길동 고객 / 본인 자택"
              onChange={(event) => set("label", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="address-memo">배송 메모</Label>
            <Input
              id="address-memo"
              value={values.memo}
              disabled={isSaving}
              placeholder="예: 부재 시 경비실"
              onChange={(event) => set("memo", event.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
          >
            취소
          </Button>
          <Button type="submit" disabled={isSaving}>
            {isSaving && <Loader2 className="animate-spin" />}
            {editingAddress ? "저장" : "등록"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

/** 배송지 1건 등록/수정 모달. 주소록 관리 화면과 견적서 발주 화면에서 함께 쓴다. */
export function AddressFormDialog({
  open,
  onOpenChange,
  editingAddress,
  onSubmit,
  profileName,
}: AddressFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} widthClassName="max-w-lg">
      <DialogContent onClose={() => onOpenChange(false)}>
        {/* key 로 다른 배송지를 열 때마다 폼을 새로 마운트해 입력값을 초기화한다. */}
        <AddressForm
          key={editingAddress?.id ?? "new"}
          editingAddress={editingAddress}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
          profileName={profileName}
        />
      </DialogContent>
    </Dialog>
  );
}
