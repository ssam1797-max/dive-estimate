"use client";

import * as React from "react";
import Script from "next/script";
import { CheckCircle2, Copy, MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { InlineToast, type ToastState } from "@/components/ui/inline-toast";

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
/**
 * 카카오톡 공유 기능 자체(SDK 연동 코드)는 이미 준비돼 있지만, 카카오
 * 개발자센터 서비스 신청/도메인 등록 승인이 날 때까지는 꺼둔다. 승인
 * 완료되면 이 값만 true 로 바꾸면 바로 실제 공유로 전환된다.
 */
const KAKAO_SHARE_ENABLED = false;

const KAKAO_PENDING_MESSAGE =
  "카카오톡 공유 기능은 카카오 승인 후 오픈 예정입니다. '내역 복사' 기능을 이용해주세요.";

interface OrderCompleteDialogProps {
  open: boolean;
  totalAmount: number;
  /** 내역 복사 버튼에 쓸, 미리 만들어둔 주문 내역 텍스트. */
  orderSummaryText: string;
  /** 확인(닫기) 버튼을 누르면 호출 — 장바구니/폼 초기화는 호출하는 쪽이 책임진다. */
  onConfirm: () => void;
}

function formatCurrency(amount: number): string {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

/**
 * [장바구니에서 구매요청] 완료 후 뜨는 주문 완료 모달. 다른 페이지로 이동하지
 * 않고 그 자리에서 입금 계좌와 복사 버튼만 보여준다. 계좌 정보는 관리자가
 * [입금 계좌 설정] 화면에서 등록해둔 값을 열릴 때마다 새로 받아온다(고객이
 * 보는 값이 항상 최신이어야 해서 props 로 미리 내려받지 않는다).
 *
 * 기본 액션은 "내역 복사"(클립보드) 다. 카카오톡 공유는 카카오 승인 전까지
 * "서비스 예정" 안내만 띄운다 — KAKAO_SHARE_ENABLED 참고.
 */
export function OrderCompleteDialog({
  open,
  totalAmount,
  orderSummaryText,
  onConfirm,
}: OrderCompleteDialogProps) {
  const [bankAccount, setBankAccount] = React.useState<BankAccountSettings | null>(null);
  const [toast, setToast] = React.useState<ToastState | null>(null);

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

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ tone: "success", message: "클립보드에 복사되었습니다." });
    } catch {
      setToast({ tone: "error", message: "클립보드 복사에 실패했습니다. 다시 시도해주세요." });
    }
  };

  /** 카카오 승인이 끝나면 KAKAO_SHARE_ENABLED 를 true 로 바꿔 이 경로를 쓴다. */
  const handleKakaoShare = () => {
    if (window.Kakao?.isInitialized()) {
      try {
        window.Kakao.Share.sendDefault({
          objectType: "text",
          text: orderSummaryText,
          link: { mobileWebUrl: window.location.origin, webUrl: window.location.origin },
        });
        return;
      } catch {
        // 카카오 공유 호출이 실패하면(팝업 차단 등) 클립보드 복사로 대체한다.
      }
    }
    copyText(orderSummaryText);
  };

  const handleKakaoClick = () => {
    if (KAKAO_SHARE_ENABLED) {
      handleKakaoShare();
      return;
    }
    setToast({ tone: "info", message: KAKAO_PENDING_MESSAGE });
  };

  const hasBankAccount = Boolean(bankAccount?.accountNumber);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onConfirm()} widthClassName="max-w-md">
      {KAKAO_SHARE_ENABLED && KAKAO_JS_KEY && (
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

        {/* 기본 액션: 내역 복사(클립보드) */}
        <Button type="button" className="w-full" onClick={() => copyText(orderSummaryText)}>
          <Copy className="size-4" />
          주문내역 복사
        </Button>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={!hasBankAccount}
            onClick={() => bankAccount && copyText(bankAccount.accountNumber)}
          >
            <Copy className="size-4" />
            계좌번호 복사
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 text-muted-foreground"
            onClick={handleKakaoClick}
          >
            <MessageCircle className="size-4" />
            카카오톡 공유
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium">
              서비스 예정
            </span>
          </Button>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onConfirm} className="w-full sm:w-auto">
            확인
          </Button>
        </DialogFooter>
      </DialogContent>

      <InlineToast toast={toast} onDismiss={() => setToast(null)} durationMs={2500} />
    </Dialog>
  );
}
