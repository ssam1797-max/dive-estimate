import * as React from "react";
import { MapPin, Phone, StickyNote } from "lucide-react";

import type { ProfileAddress } from "@/lib/estimates/types";
import { cn } from "@/lib/utils";

/** 주소록 항목의 표시 이름 — 구분 이름이 없으면 받는사람 이름. */
export function addressDisplayName(address: ProfileAddress): string {
  return address.label?.trim() || address.recipientName;
}

interface AddressCardProps {
  address: ProfileAddress;
  /** 오른쪽에 붙일 버튼들(수정/삭제 등). */
  actions?: React.ReactNode;
  className?: string;
}

/** 배송지 1건을 받는사람·연락처·주소·메모 순으로 보여주는 카드. */
export function AddressCard({ address, actions, className }: AddressCardProps) {
  const displayName = addressDisplayName(address);
  const showRecipient = displayName !== address.recipientName;

  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5 text-sm">
        <span className="truncate font-medium">
          {displayName}
          {showRecipient && (
            <span className="ml-1.5 font-normal text-muted-foreground">
              (받는사람 {address.recipientName})
            </span>
          )}
        </span>
        {address.contact && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Phone className="size-3 shrink-0" />
            {address.contact}
          </span>
        )}
        <span className="inline-flex items-start gap-1 text-xs text-muted-foreground">
          <MapPin className="mt-0.5 size-3 shrink-0" />
          <span className="break-keep">{address.address}</span>
        </span>
        {address.memo && (
          <span className="inline-flex items-start gap-1 text-xs text-muted-foreground">
            <StickyNote className="mt-0.5 size-3 shrink-0" />
            <span className="break-keep">{address.memo}</span>
          </span>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
