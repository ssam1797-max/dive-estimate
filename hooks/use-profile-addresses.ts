"use client";

import * as React from "react";

import type { ProfileAddress } from "@/lib/estimates/types";

/** 주소록 등록/수정 폼 값 (API 요청 바디와 같은 형태). */
export interface ProfileAddressFormValues {
  label: string;
  recipientName: string;
  contact: string;
  address: string;
  memo: string;
}

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  return (body as { error?: string } | null)?.error ?? fallback;
}

/**
 * 공급받는자 1명의 주소록(배송지 목록)을 불러오고 추가/수정/삭제한다.
 * profileId 가 null 이면 아무것도 불러오지 않는다(다이얼로그가 닫혀 있을 때 등).
 *
 * create/update/remove 는 실패하면 예외를 던진다 — 폼/확인 다이얼로그가
 * 그 메시지를 그대로 보여줄 수 있게.
 */
export function useProfileAddresses(profileId: string | null) {
  const [addresses, setAddresses] = React.useState<ProfileAddress[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!profileId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAddresses([]);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const response = await fetch(`/api/profiles/${profileId}/addresses`);
        if (!response.ok) {
          throw new Error(await readError(response, "주소록을 불러오지 못했습니다."));
        }
        const body = (await response.json()) as { addresses: ProfileAddress[] };
        if (!cancelled) setAddresses(body.addresses);
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "주소록을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId, reloadKey]);

  const reload = React.useCallback(() => setReloadKey((key) => key + 1), []);

  const create = React.useCallback(
    async (values: ProfileAddressFormValues): Promise<ProfileAddress> => {
      if (!profileId) throw new Error("공급받는자가 선택되지 않았습니다.");
      const response = await fetch(`/api/profiles/${profileId}/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "배송지 등록에 실패했습니다."));
      }
      const { address } = (await response.json()) as { address: ProfileAddress };
      setAddresses((prev) => [...prev, address]);
      return address;
    },
    [profileId]
  );

  const update = React.useCallback(
    async (addressId: string, values: ProfileAddressFormValues): Promise<ProfileAddress> => {
      if (!profileId) throw new Error("공급받는자가 선택되지 않았습니다.");
      const response = await fetch(`/api/profiles/${profileId}/addresses/${addressId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error(await readError(response, "배송지 수정에 실패했습니다."));
      }
      const { address } = (await response.json()) as { address: ProfileAddress };
      setAddresses((prev) => prev.map((item) => (item.id === address.id ? address : item)));
      return address;
    },
    [profileId]
  );

  const remove = React.useCallback(
    async (addressId: string): Promise<void> => {
      if (!profileId) throw new Error("공급받는자가 선택되지 않았습니다.");
      const response = await fetch(`/api/profiles/${profileId}/addresses/${addressId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error(await readError(response, "배송지 삭제에 실패했습니다."));
      }
      setAddresses((prev) => prev.filter((item) => item.id !== addressId));
    },
    [profileId]
  );

  return { addresses, isLoading, loadError, reload, create, update, remove };
}
