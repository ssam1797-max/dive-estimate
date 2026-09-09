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
import { StampFileInput } from "@/components/profiles/stamp-file-input";
import type { ProfileOption } from "@/lib/estimates/types";

export interface ProfileFormValues {
  name: string;
  contact: string;
  address: string;
  stampUrl: string;
  businessNumber: string;
  representative: string;
  businessType: string;
  businessCategory: string;
  email: string;
}

interface ProfileFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "PROVIDER" | "RECEIVER";
  /** 수정 대상. null 이면 신규 등록 폼. */
  editingProfile: ProfileOption | null;
  onSubmit: (values: ProfileFormValues) => Promise<void>;
}

function toFormValues(profile: ProfileOption | null): ProfileFormValues {
  return {
    name: profile?.name ?? "",
    contact: profile?.contact ?? "",
    address: profile?.address ?? "",
    stampUrl: profile?.stampUrl ?? "",
    businessNumber: profile?.businessNumber ?? "",
    representative: profile?.representative ?? "",
    businessType: profile?.businessType ?? "",
    businessCategory: profile?.businessCategory ?? "",
    email: profile?.email ?? "",
  };
}

function ProfileForm({
  type,
  editingProfile,
  onOpenChange,
  onSubmit,
}: Omit<ProfileFormDialogProps, "open">) {
  const [values, setValues] = React.useState<ProfileFormValues>(() =>
    toFormValues(editingProfile)
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const set = <K extends keyof ProfileFormValues>(key: K, value: string) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!values.name.trim()) {
      setError("상호(이름)를 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSubmit(values);
      onOpenChange(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "저장 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const typeLabel = type === "PROVIDER" ? "공급자" : "공급받는자";

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {editingProfile ? `${typeLabel} 정보 수정` : `${typeLabel} 신규 등록`}
        </DialogTitle>
        <DialogDescription>
          {type === "PROVIDER"
            ? "견적서 상단에 표시될 공급자(우리 회사) 정보입니다."
            : "견적서를 받을 고객/관공서 정보입니다. 상호명만 입력해도 등록할 수 있습니다."}
        </DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="profile-name">상호(이름) *</Label>
            <Input
              id="profile-name"
              autoFocus
              value={values.name}
              disabled={isSaving}
              placeholder={type === "PROVIDER" ? "예: 오션다이브 강남점" : "예: 보성소방서"}
              onChange={(event) => set("name", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-contact">전화</Label>
            <Input
              id="profile-contact"
              value={values.contact}
              disabled={isSaving}
              onChange={(event) => set("contact", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="profile-email">이메일</Label>
            <Input
              id="profile-email"
              type="email"
              value={values.email}
              disabled={isSaving}
              onChange={(event) => set("email", event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="profile-address">주소</Label>
            <Input
              id="profile-address"
              value={values.address}
              disabled={isSaving}
              onChange={(event) => set("address", event.target.value)}
            />
          </div>

          {type === "PROVIDER" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-business-number">사업자번호</Label>
                <Input
                  id="profile-business-number"
                  value={values.businessNumber}
                  disabled={isSaving}
                  onChange={(event) => set("businessNumber", event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-representative">대표자</Label>
                <Input
                  id="profile-representative"
                  value={values.representative}
                  disabled={isSaving}
                  onChange={(event) => set("representative", event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-business-type">업태</Label>
                <Input
                  id="profile-business-type"
                  value={values.businessType}
                  disabled={isSaving}
                  onChange={(event) => set("businessType", event.target.value)}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="profile-business-category">종목</Label>
                <Input
                  id="profile-business-category"
                  value={values.businessCategory}
                  disabled={isSaving}
                  onChange={(event) => set("businessCategory", event.target.value)}
                />
              </div>

              <div className="sm:col-span-2">
                <StampFileInput
                  value={values.stampUrl}
                  disabled={isSaving}
                  onChange={(dataUri) => set("stampUrl", dataUri)}
                />
              </div>
            </>
          )}
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
            {editingProfile ? "저장" : "등록"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function ProfileFormDialog({
  open,
  onOpenChange,
  type,
  editingProfile,
  onSubmit,
}: ProfileFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        {/* editingProfile.id 를 key 로 써서, 다른 프로필을 열거나 신규 등록으로
            전환할 때 폼이 새로 마운트되어 입력값이 항상 올바르게 초기화된다. */}
        <ProfileForm
          key={editingProfile?.id ?? "new"}
          type={type}
          editingProfile={editingProfile}
          onOpenChange={onOpenChange}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
