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

interface TemplateSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (templateName: string) => Promise<void>;
}

/**
 * 다이얼로그가 열릴 때마다 새로 마운트되는 폼.
 * (컴포넌트가 새로 마운트되므로 useEffect 로 상태를 초기화하지 않아도
 *  열릴 때마다 항상 빈 입력값으로 시작합니다.)
 */
function TemplateSaveForm({
  onOpenChange,
  onSave,
}: Omit<TemplateSaveDialogProps, "open">) {
  const [templateName, setTemplateName] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!templateName.trim()) {
      setError("템플릿 이름을 입력해주세요.");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(templateName.trim());
      onOpenChange(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "템플릿 저장 중 오류가 발생했습니다."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>템플릿으로 저장</DialogTitle>
        <DialogDescription>
          현재 담긴 장비 목록을 템플릿으로 저장합니다. (예: 오픈워터 패키지)
        </DialogDescription>
      </DialogHeader>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="template-name">템플릿 이름</Label>
          <Input
            id="template-name"
            autoFocus
            value={templateName}
            disabled={isSaving}
            placeholder="예: 오픈워터 패키지"
            onChange={(event) => setTemplateName(event.target.value)}
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

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
            저장
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}

export function TemplateSaveDialog({
  open,
  onOpenChange,
  onSave,
}: TemplateSaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <TemplateSaveForm onOpenChange={onOpenChange} onSave={onSave} />
      </DialogContent>
    </Dialog>
  );
}
