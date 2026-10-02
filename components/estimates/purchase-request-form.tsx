"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  /** 확인을 누르면 호출된다. 실패하면 에러를 throw 하면 폼이 그 메시지를 보여준다. */
  onSubmit: (contact: PurchaseRequestContact) => Promise<void>;
}

/**
 * [장바구니에서 구매요청] 버튼을 누르면 나타나는 하단 폼 — 이름/전화번호/
 * 배송주소만 받는다. 공급자·공급받는자 등 정식 견적서 입력 항목을 몰라도
 * 되도록, 받는 분 정보만으로 장바구니 내용을 접수한다. 입력값은
 * localStorage 에 저장해 다음에 다시 열었을 때 자동으로 채워준다.
 */
export function PurchaseRequestForm({ disabled, onSubmit }: PurchaseRequestFormProps) {
  const [name, setName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<PurchaseRequestContact>;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(parsed.name ?? "");
      setPhone(parsed.phone ?? "");
      setAddress(parsed.address ?? "");
    } catch {
      // localStorage 접근 실패(시크릿 모드 등)는 무시 — 빈 값으로 시작한다.
    }
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

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ name, phone, address })
      );
    } catch {
      // 다음 입력 자동완성이 안 될 뿐, 접수 자체에는 지장 없다.
    }

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), phone: phone.trim(), address: address.trim() });
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
          <Label htmlFor="purchase-address">배송주소</Label>
          <Input
            id="purchase-address"
            value={address}
            disabled={disabled || isSubmitting}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="배송받으실 주소를 입력하세요 (선택)"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={disabled || isSubmitting}
          className="self-start"
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          확인
        </Button>
      </CardContent>
    </Card>
  );
}
