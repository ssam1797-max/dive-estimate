"use client";

import * as React from "react";
import { Loader2, Plus, Truck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { addressDisplayName } from "@/components/profiles/address-card";
import { AddressFormDialog } from "@/components/profiles/address-form-dialog";
import {
  useProfileAddresses,
  type ProfileAddressFormValues,
} from "@/hooks/use-profile-addresses";
import type {
  ProfileAddress,
  ProfileOption,
  ShippingDestination,
} from "@/lib/estimates/types";

/** 드롭다운 특수 값 — 주소록 항목 id(uuid)와 겹치지 않는다. */
const DEFAULT_VALUE = "__receiver_default__";
const SNAPSHOT_VALUE = "__saved_snapshot__";

function toDestination(address: ProfileAddress): ShippingDestination {
  return {
    name: address.recipientName,
    contact: address.contact ?? "",
    address: address.address,
    memo: address.memo ?? "",
  };
}

function isSameDestination(a: ShippingDestination, b: ShippingDestination): boolean {
  const normalize = (value: string) => value.replace(/\s+/g, "");
  return (
    normalize(a.name) === normalize(b.name) &&
    a.contact.replace(/\D/g, "") === b.contact.replace(/\D/g, "") &&
    normalize(a.address) === normalize(b.address) &&
    normalize(a.memo) === normalize(b.memo)
  );
}

async function saveEstimateShipping(
  estimateId: string,
  shipTo: ShippingDestination | null
): Promise<void> {
  const response = await fetch(`/api/estimates/${estimateId}/shipping`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shipTo }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error((body as { error?: string } | null)?.error ?? "배송지 저장에 실패했습니다.");
  }
}

interface ShippingAddressSelectProps {
  estimateId: string;
  /** 견적서의 공급받는자. 삭제된 프로필이면 null — 주소록 없이 기본값만 고를 수 있다. */
  receiver: ProfileOption | null;
  /** 현재 저장된 발주 배송지(null = 공급받는자 기본 정보). */
  shipTo: ShippingDestination | null;
  /** 서버 저장에 성공한 뒤 호출된다 — 발주 문구 미리보기 갱신용. */
  onChange: (shipTo: ShippingDestination | null) => void;
}

/**
 * 보관함 견적서 상세의 [발주 받는사람] 선택. 공급받는자 기본 정보 또는
 * 주소록의 배송지 중 하나를 골라 견적서에 저장한다(발주 복사/공유/묶음
 * 발주 모두 이 값을 쓴다). 그 자리에서 새 배송지를 주소록에 추가할 수도 있다.
 */
export function ShippingAddressSelect({
  estimateId,
  receiver,
  shipTo,
  onChange,
}: ShippingAddressSelectProps) {
  const { addresses, isLoading, loadError, create } = useProfileAddresses(receiver?.id ?? null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);

  const matchedAddress = shipTo
    ? addresses.find((address) => isSameDestination(toDestination(address), shipTo))
    : undefined;
  // 저장된 배송지가 주소록에서 수정/삭제돼 더 이상 일치하는 항목이 없어도
  // 견적서에 저장된 값(스냅샷)을 그대로 보여준다.
  const selectedValue = !shipTo
    ? DEFAULT_VALUE
    : matchedAddress
      ? matchedAddress.id
      : SNAPSHOT_VALUE;

  const applyShipTo = async (next: ShippingDestination | null) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await saveEstimateShipping(estimateId, next);
      onChange(next);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "배송지 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelect = (value: string) => {
    if (value === selectedValue || value === SNAPSHOT_VALUE) return;
    if (value === DEFAULT_VALUE) {
      void applyShipTo(null);
      return;
    }
    const address = addresses.find((item) => item.id === value);
    if (address) void applyShipTo(toDestination(address));
  };

  /** 새 배송지를 주소록에 추가하고 바로 이 견적서의 받는사람으로 지정한다. */
  const handleCreate = async (values: ProfileAddressFormValues) => {
    const created = await create(values);
    await applyShipTo(toDestination(created));
  };

  const defaultLabel = receiver
    ? `${receiver.name} (공급받는자 기본 정보)`
    : "공급받는자 기본 정보";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Truck className="size-3.5" />
        발주 받는사람(배송지)
        {(isSaving || isLoading) && <Loader2 className="size-3 animate-spin" />}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Select
            value={selectedValue}
            disabled={isSaving || isLoading}
            onChange={(event) => handleSelect(event.target.value)}
            aria-label="발주 받는사람(배송지) 선택"
          >
            <option value={DEFAULT_VALUE}>{defaultLabel}</option>
            {selectedValue === SNAPSHOT_VALUE && shipTo && (
              <option value={SNAPSHOT_VALUE}>
                {shipTo.name} (이 견적서에 저장된 배송지)
              </option>
            )}
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {addressDisplayName(address)} · {address.address}
              </option>
            ))}
          </Select>
        </div>
        {receiver && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={isSaving || isLoading || Boolean(loadError)}
            onClick={() => setFormOpen(true)}
          >
            <Plus className="size-4" />
            새 배송지
          </Button>
        )}
      </div>
      {loadError && (
        <p className="text-xs text-destructive">
          주소록을 불러오지 못했습니다: {loadError}
        </p>
      )}
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}

      {receiver && (
        <AddressFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          editingAddress={null}
          onSubmit={handleCreate}
          profileName={receiver.name}
        />
      )}
    </div>
  );
}
