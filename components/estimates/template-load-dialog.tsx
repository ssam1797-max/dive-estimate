"use client";

import * as React from "react";
import { Loader2, PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TemplateSummary } from "@/lib/estimates/types";

interface TemplateLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateSummary[];
  onSelect: (templateId: string) => Promise<void>;
}

/**
 * 다이얼로그가 열릴 때마다 새로 마운트되는 목록.
 * (컴포넌트가 새로 마운트되므로 useEffect 로 상태를 초기화하지 않아도
 *  열릴 때마다 항상 깨끗한 상태로 시작합니다.)
 */
function TemplateLoadList({
  templates,
  onSelect,
  onOpenChange,
}: Omit<TemplateLoadDialogProps, "open">) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleSelect = async (templateId: string) => {
    setLoadingId(templateId);
    setError(null);
    try {
      await onSelect(templateId);
      onOpenChange(false);
    } catch (selectError) {
      setError(
        selectError instanceof Error
          ? selectError.message
          : "템플릿을 불러오지 못했습니다."
      );
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>템플릿 불러오기</DialogTitle>
        <DialogDescription>
          저장된 템플릿을 선택하면 현재 견적 목록이 템플릿 내용으로
          교체됩니다.
        </DialogDescription>
      </DialogHeader>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {templates.length === 0 ? (
        <p className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
          <PackageOpen className="size-8" />
          저장된 템플릿이 없습니다.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
          {templates.map((template) => (
            <li key={template.id}>
              <Button
                type="button"
                variant="outline"
                disabled={loadingId !== null}
                onClick={() => handleSelect(template.id)}
                className="h-auto w-full justify-between px-3 py-2 text-left"
              >
                <span className="flex flex-col items-start">
                  <span className="font-medium">{template.templateName}</span>
                  <span className="text-xs text-muted-foreground">
                    장비 {template.itemCount}건
                  </span>
                </span>
                {loadingId === template.id && (
                  <Loader2 className="size-4 animate-spin" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function TemplateLoadDialog({
  open,
  onOpenChange,
  templates,
  onSelect,
}: TemplateLoadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <TemplateLoadList
          onOpenChange={onOpenChange}
          templates={templates}
          onSelect={onSelect}
        />
      </DialogContent>
    </Dialog>
  );
}
