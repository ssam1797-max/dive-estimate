"use client";

import * as React from "react";
import Script from "next/script";
import { CheckCircle2, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BankAccountSettings {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
}

declare global {
  interface Window {
    Kakao?: {
      init: (key: string) => void;
      isInitialized: () => boolean;
      Share: {
        sendDefault: (options: {
          objectType: "text";
          text: string;
          link: { mobileWebUrl: string; webUrl: string };
        }) => void;
      };
    };
  }
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

interface OrderCompleteDialogProps {
  open: boolean;
  totalAmount: number;
  /** 카톡 공유/복사 버튼에 쓸, 미리 만들어둔 주문 내역 텍스트. */
  orderSummaryText: string;
  /** 확인(닫기) 버튼을 누르면 호출 — 장바구니/폼 초기화는 호출하는 쪽이 책임진다. */
  onConfirm: () => void;
}

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

/**
 * [장바구니에서 구매요청] 완료 후 뜨는 주문 완료 모달. 다른 페이지로 이동하지
 * 않고 그 자리에서 입금 계좌와 복사/공유 버튼만 보여준다. 계좌 정보는
 * 관리자가 [입금 계좌 설정] 화면에서 등록해둔 값을 열릴 때마다 새로 받아온다
 * (고객이 보는 값이 항상 최신이어야 해서 props 로 미리 내려받지 않는다).
 */
export function OrderCompleteDialog({
  open,
  totalAmount,
  orderSummaryText,
  onConfirm,
}: OrderCompleteDialogProps) {
  const [bankAccount, setBankAccount] = React.useState<BankAccountSettings | null>(null);
  const [copiedField, setCopiedField] = React.useState<"account" | "summary" | null>(null);

  const handleKakaoReady = () => {
    if (KAKAO_JS_KEY && window.Kakao && !window.Kakao.isInitialized()) {
      window.Kakao.init(KAKAO_JS_KEY);
    }
  };

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBankAccount(null);
    (async () => {
      try {
        const response = await fetch("/api/settings/bank-account");
        const body = await response.json();
        if (!cancelled && response.ok) {
          setBankAccount(body as BankAccountSettings);
        }
      } catch {
        // 계좌 정보 조회 실패해도 주문 완료 자체는 이미 끝난 상태라, 안내
        // 문구만 못 보여줄 뿐 접수에는 지장 없다.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const copyText = async (text: string, field: "account" | "summary") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField((prev) => (prev === field ? null : prev)), 2000);
    } catch {
      // 클립보드 접근이 막혀 있으면(권한 거부 등) 조용히 무시 — 버튼을 다시 누르면 된다.
    }
  };

  /**
   * 카카오톡 공유. 카카오 개발자 키(NEXT_PUBLIC_KAKAO_JS_KEY)가 설정돼 있으면
   * 카카오의 "카카오톡 공유하기" API로 보낸다 — 로그인 후 친구/채팅방을 골라
   * 바로 전달되므로, PC에서도 실제 카카오톡으로 공유된다. 키가 없거나 SDK
   * 로드에 실패하면(설정 전/네트워크 문제) OS 공유 시트(navigator.share, 모바일
   * 한정)나 클립보드 복사로 대체한다 — Windows PC의 navigator.share는 카카오톡이
   * 등록돼 있지 않은 OS 공유창만 떠서 실질적으로 쓸모가 없다.
   */
  const handleShare = async () => {
    if (window.Kakao?.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "text",
          text: orderSummaryText,
          link: { mobileWebUrl: window.location.origin, webUrl: window.location.origin },
        });
        return;
      } catch {
        // 카카오 공유 호출이 실패하면(팝업 차단 등) 아래 대체 수단으로 넘어간다.
      }
    }
    if (navigator.share) {
      try {
        await navigator.share({ text: orderSummaryText });
        return;
      } catch {
        // 공유 시트를 취소했거나 지원하지 않으면 클립보드 복사로 대체한다.
      }
    }
    await copyText(orderSummaryText, "summary");
  };

  const hasBankAccount = Boolean(bankAccount?.accountNumber);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onConfirm()} widthClassName="max-w-md">
      {KAKAO_JS_KEY && (
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
          strategy="lazyOnload"
          onReady={handleKakaoReady}
        />
      )}
      <DialogContent onClose={onConfirm}>
        <DialogHeader>
          <DialogTitle>
            <span className="inline-flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
              주문(구매요청)이 정상 접수되었습니다.
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-1 rounded-md bg-muted/40 p-3">
          <span className="text-sm text-muted-foreground">총 주문 금액</span>
          <span className="text-xl font-semibold">{formatCurrency(totalAmount)}</span>
        </div>

        <div className="flex flex-col gap-2 rounded-md border p-3">
          <span className="text-sm font-medium">입금 계좌 정보</span>
          {!bankAccount ? (
            <p className="text-sm text-muted-foreground">불러오는 중...</p>
          ) : !hasBankAccount ? (
            <p className="text-sm text-muted-foreground">
              아직 등록된 입금 계좌 정보가 없습니다. 담당자에게 문의해주세요.
            </p>
          ) : (
            <div className="flex flex-col gap-1 text-sm">
              <span>
                {bankAccount.bankName} {bankAccount.accountNumber}
              </span>
              <span className="text-muted-foreground">예금주: {bankAccount.accountHolder}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={!hasBankAccount}
            onClick={() => bankAccount && copyText(bankAccount.accountNumber, "account")}
          >
            <Copy className="size-4" />
            {copiedField === "account" ? "복사됨" : "계좌번호 복사"}
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={handleShare}>
            <Share2 className="size-4" />
            {copiedField === "summary" ? "복사됨" : "주문내역 카톡 공유 / 복사"}
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onConfirm} className="w-full sm:w-auto">
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
