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
import {
  ESTIMATE_PASSWORD_HELP_TEXT,
  ESTIMATE_PASSWORD_REGEX,
} from "@/lib/estimates/estimatePasswordRules";

interface EstimatePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** 비밀번호를 입력받아 실제 저장을 수행한다. 실패 시 에러를 throw 하면 다이얼로그가 닫히지 않고 메시지를 보여준다. */
  onSubmit: (password: string) => Promise<void>;
}

/**
 * 견적서를 새로 저장(또는 복사 저장)할 때 수정/삭제 보호용 비밀번호를
 * 설정받는 다이얼로그. 저장 자체가 실패하면(네트워크 오류 등) 다이얼로그를
 * 닫지 않고 에러만 보여줘, 사용자가 다시 시도할 수 있게 한다.
 */
export function EstimatePasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  onSubmit,
}: EstimatePasswordDialogProps) {
  const [password, setPassword] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPassword("");
    setError(null);
    setIsSubmitting(false);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ESTIMATE_PASSWORD_REGEX.test(password)) {
      setError(`비밀번호 형식이 올바르지 않습니다. ${ESTIMATE_PASSWORD_HELP_TEXT}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "저장 중 오류가 발생했습니다."
      );
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={password}
            disabled={isSubmitting}
            onChange={(event) => setPassword(event.target.value.replace(/\D/g, ""))}
            placeholder="예: 1234"
            aria-label="견적서 비밀번호"
          />
          <p className="text-xs text-muted-foreground">{ESTIMATE_PASSWORD_HELP_TEXT}</p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              취소
            </Button>
            <Button type="submit" disabled={isSubmitting || !password}>
              {isSubmitting && <Loader2 className="animate-spin" />}
              확인
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
