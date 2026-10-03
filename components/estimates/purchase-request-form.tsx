"use client";

import * as React from "react";
import Script from "next/script";
import { Loader2, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** 다음에 또 쓸 수 있도록 브라우저에 기억해두는 키. 이 기기/브라우저에만 저장된다. */
const STORAGE_KEY = "dive-estimate:purchase-request-contact";

export interface PurchaseRequestContact {
  name: string;
  phone: string;
  address: string;
}

interface PurchaseRequestFormProps {
  disabled?: boolean;
  /**
   * 견적서 번호를 아직 발급받는 중이면 true — 이 번호가 있어야 접수가
   * 가능한데, 모바일 등 느린 연결에서는 사용자가 폼을 다 채우는 동안에도
   * 발급이 안 끝나 있을 수 있다. "확인"을 눌렀다가 빨간 에러를 보는 대신,
   * 끝날 때까지 버튼을 비활성화하고 안내 문구를 보여준다.
   */
  isEstimateNumberLoading?: boolean;
  /** 확인을 누르면 호출된다. 실패하면 에러를 throw 하면 폼이 그 메시지를 보여준다. */
  onSubmit: (contact: PurchaseRequestContact) => Promise<void>;
}

interface DaumPostcodeData {
  zonecode: string;
  roadAddress: string;
  jibunAddress: string;
}

declare global {
  interface Window {
    daum?: {
      Postcode: new (options: {
        oncomplete: (data: DaumPostcodeData) => void;
        width?: string | number;
        height?: string | number;
      }) => {
        embed: (element: HTMLElement) => void;
      };
    };
  }
}

/**
 * [장바구니에서 구매요청] 버튼을 누르면 나타나는 하단 폼 — 이름/전화번호/
 * 배송주소만 받는다. 공급자·공급받는자 등 정식 견적서 입력 항목을 몰라도
 * 되도록, 받는 분 정보만으로 장바구니 내용을 접수한다. 입력값은
 * localStorage 에 저장해 다음에 다시 열었을 때 자동으로 채워준다.
 *
 * 배송주소는 오배송을 막기 위해 직접 타이핑하지 않고, 카카오(다음) 우편번호
 * 서비스 팝업에서 검색해 고른 도로명주소만 기본주소로 쓰고 상세주소(동/호수
 * 등)만 직접 입력하게 한다.
 */
export function PurchaseRequestForm({
  disabled,
  isEstimateNumberLoading,
  onSubmit,
}: PurchaseRequestFormProps) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [zonecode, setZonecode] = React.useState("");
  const [baseAddress, setBaseAddress] = React.useState("");
  const [addressDetail, setAddressDetail] = React.useState("");
  const [isPostcodeReady, setIsPostcodeReady] = React.useState(false);
  const [isAddressSearchOpen, setIsAddressSearchOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as {
        name?: string;
        phone?: string;
        zonecode?: string;
        baseAddress?: string;
        addressDetail?: string;
      };
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(parsed.name ?? "");
      setPhone(parsed.phone ?? "");
      setZonecode(parsed.zonecode ?? "");
      setBaseAddress(parsed.baseAddress ?? "");
      setAddressDetail(parsed.addressDetail ?? "");
    } catch {
      // localStorage 접근 실패(시크릿 모드 등)는 무시 — 빈 값으로 시작한다.
    }
  }, []);

  const openAddressSearch = () => {
    if (!window.daum?.Postcode) return;
    setIsAddressSearchOpen(true);
  };

  /**
   * 팝업 창(window.open)으로 띄우는 기본 방식 대신, 모달 안에 검색창을 직접
   * 그려 넣는(embed) 방식을 쓴다 — 팝업 차단 설정이나 모바일 브라우저의
   * 팝업 제약에 영향받지 않고 항상 똑같이 동작하게 하기 위해서다. 모달이
   * 열릴 때마다(= 이 div 가 새로 마운트될 때마다) 콜백 ref 로 그 자리에서
   * 바로 임베드한다.
   */
  const setPostcodeContainer = React.useCallback((node: HTMLDivElement | null) => {
    if (!node || !window.daum?.Postcode) return;
    new window.daum.Postcode({
      oncomplete: (data) => {
        setZonecode(data.zonecode);
        setBaseAddress(data.roadAddress || data.jibunAddress);
        setIsAddressSearchOpen(false);
      },
      width: "100%",
      height: "100%",
    }).embed(node);
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!phone.trim()) {
      setError("전화번호를 입력해주세요.");
      return;
    }
    if (!baseAddress.trim()) {
      setError("배송주소를 검색해 입력해주세요.");
      return;
    }

    const fullAddress = [
      zonecode && `[${zonecode}]`,
      baseAddress.trim(),
      addressDetail.trim(),
    ]
      .filter(Boolean)
      .join(" ");

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name, phone, zonecode, baseAddress, addressDetail })
      );
    } catch {
      // 다음 입력 자동완성이 안 될 뿐, 접수 자체에는 지장 없다.
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim(), address: fullAddress });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "처리 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <Script
        src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"
        strategy="lazyOnload"
        onReady={() => setIsPostcodeReady(true)}
      />
      <CardHeader>
        <CardTitle>구매요청 정보</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          받으실 분 정보를 입력하고 확인을 누르면, 장바구니 내용이 구매요청으로
          접수됩니다.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="purchase-name">이름</Label>
            <Input
              id="purchase-name"
              value={name}
              disabled={disabled || isSubmitting}
              onChange={(event) => setName(event.target.value)}
              placeholder="홍길동"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="purchase-phone">전화번호</Label>
            <Input
              id="purchase-phone"
              type="tel"
              value={phone}
              disabled={disabled || isSubmitting}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="010-1234-5678"
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="purchase-address">배송주소 *</Label>
          <div className="flex gap-2">
            <Input
              id="purchase-address"
              value={zonecode ? `[${zonecode}] ${baseAddress}` : baseAddress}
              readOnly
              onClick={openAddressSearch}
              disabled={disabled || isSubmitting}
              placeholder="주소 검색 버튼을 눌러주세요"
              className="cursor-pointer bg-muted/40"
            />
            <Button
              type="button"
              variant="outline"
              onClick={openAddressSearch}
              disabled={disabled || isSubmitting || !isPostcodeReady}
              className="shrink-0"
            >
              <Search className="size-4" />
              주소 검색
            </Button>
          </div>
          <Input
            value={addressDetail}
            disabled={disabled || isSubmitting}
            onChange={(event) => setAddressDetail(event.target.value)}
            placeholder="상세주소 (동/호수 등, 선택)"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {isEstimateNumberLoading && (
          <p className="text-xs text-muted-foreground">
            견적서 번호를 발급받는 중입니다. 잠시만 기다려주세요...
          </p>
        )}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || isEstimateNumberLoading}
          className="self-start"
        >
          {(isSubmitting || isEstimateNumberLoading) && <Loader2 className="animate-spin" />}
          확인
        </Button>
      </CardContent>

      <Dialog
        open={isAddressSearchOpen}
        onOpenChange={setIsAddressSearchOpen}
        widthClassName="max-w-lg"
      >
        <DialogContent onClose={() => setIsAddressSearchOpen(false)}>
          <DialogHeader>
            <DialogTitle>배송지 주소 검색</DialogTitle>
          </DialogHeader>
          <div ref={setPostcodeContainer} className="h-[420px] w-full" />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
