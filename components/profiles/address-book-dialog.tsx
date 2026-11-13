"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, RotateCw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressCard, addressDisplayName } from "@/components/profiles/address-card";
import { AddressFormDialog } from "@/components/profiles/address-form-dialog";
import {
  useProfileAddresses,
  type ProfileAddressFormValues,
} from "@/hooks/use-profile-addresses";
import type { ProfileAddress, ProfileOption } from "@/lib/estimates/types";

interface AddressBookDialogProps {
  /** 주소록을 열 공급받는자. null 이면 닫힌 상태. */
  profile: ProfileOption | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * 공급받는자 주소록 관리 모달 — 받는사람/연락처/주소를 여러 개 등록해 두고,
 * 보관함에서 발주할 때 그중 하나를 골라 받는사람으로 쓴다.
 */
export function AddressBookDialog({ profile, onOpenChange }: AddressBookDialogProps) {
  const { addresses, isLoading, loadError, reload, create, update, remove } =
    useProfileAddresses(profile?.id ?? null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingAddress, setEditingAddress] = React.useState<ProfileAddress | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ProfileAddress | null>(null);

  const openCreate = () => {
    setEditingAddress(null);
    setFormOpen(true);
  };

  const openEdit = (address: ProfileAddress) => {
    setEditingAddress(address);
    setFormOpen(true);
  };

  const handleSubmit = async (values: ProfileAddressFormValues) => {
    if (editingAddress) {
      await update(editingAddress.id, values);
    } else {
      await create(values);
    }
  };

  const hasDefaultInfo = Boolean(profile?.contact || profile?.address);

  return (
    <Dialog open={profile !== null} onOpenChange={onOpenChange} widthClassName="max-w-lg">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{profile?.name} 주소록</DialogTitle>
          <DialogDescription>
            발주할 때 고를 수 있는 받는사람 목록입니다. 강사님 대신 고객에게 바로
            보내야 할 때 여기 등록한 배송지를 선택하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">기본 정보 (공급받는자 본인)</p>
            {hasDefaultInfo ? (
              <p className="mt-0.5 text-sm break-keep">
                {profile?.name}
                {profile?.contact && ` · ${profile.contact}`}
                {profile?.address && ` · ${profile.address}`}
              </p>
            ) : (
              <p className="mt-0.5 text-sm text-muted-foreground">
                연락처/주소가 비어 있습니다. 공급받는자 정보 수정에서 입력할 수 있습니다.
              </p>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              주소록을 불러오는 중...
            </div>
          ) : loadError ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <p className="text-sm text-destructive">{loadError}</p>
              <Button type="button" variant="outline" size="sm" onClick={reload}>
                <RotateCw className="size-4" />
                다시 시도
              </Button>
            </div>
          ) : addresses.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              등록된 배송지가 없습니다.
            </p>
          ) : (
            <ul className="flex max-h-[50vh] flex-col divide-y overflow-y-auto">
              {addresses.map((address) => (
                <li key={address.id} className="py-3">
                  <AddressCard
                    address={address}
                    actions={
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`${addressDisplayName(address)} 수정`}
                          onClick={() => openEdit(address)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`${addressDisplayName(address)} 삭제`}
                          onClick={() => setDeleteTarget(address)}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={openCreate}
            disabled={isLoading || Boolean(loadError)}
          >
            <Plus className="size-4" />
            배송지 추가
          </Button>
          <Button type="button" onClick={() => onOpenChange(false)}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>

      <AddressFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingAddress={editingAddress}
        onSubmit={handleSubmit}
        profileName={profile?.name}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`"${deleteTarget ? addressDisplayName(deleteTarget) : ""}" 배송지를 삭제할까요?`}
        description="이미 이 배송지로 발주한 견적서의 받는사람 정보는 그대로 유지됩니다."
        onConfirm={() => {
          if (deleteTarget) return remove(deleteTarget.id);
        }}
      />
    </Dialog>
  );
}
