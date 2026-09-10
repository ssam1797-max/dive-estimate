"use client";

import * as React from "react";
import { Check, Loader2, PackageOpen, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TemplateSummary } from "@/lib/estimates/types";

interface TemplateLoadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: TemplateSummary[];
  onSelect: (templateId: string) => Promise<void>;
  onDelete: (templateId: string) => Promise<void>;
  onRename: (templateId: string, newName: string) => Promise<void>;
}

/**
 * 다이얼로그가 열릴 때마다 새로 마운트되는 목록.
 * (컴포넌트가 새로 마운트되므로 useEffect 로 상태를 초기화하지 않아도
 *  열릴 때마다 항상 깨끗한 상태로 시작합니다.)
 */
function TemplateLoadList({
  templates,
  onSelect,
  onDelete,
  onRename,
  onOpenChange,
}: Omit<TemplateLoadDialogProps, "open">) {
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [isRenaming, setIsRenaming] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<TemplateSummary | null>(null);

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

  const startRename = (template: TemplateSummary, event: React.MouseEvent) => {
    event.stopPropagation();
    setRenamingId(template.id);
    setRenameValue(template.templateName);
    setError(null);
  };

  const cancelRename = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setRenamingId(null);
    setRenameValue("");
  };

  const submitRename = async (templateId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const trimmed = renameValue.trim();
    if (!trimmed) {
      setError("템플릿 이름을 입력해주세요.");
      return;
    }
    setIsRenaming(true);
    setError(null);
    try {
      await onRename(templateId, trimmed);
      setRenamingId(null);
    } catch (renameError) {
      setError(
        renameError instanceof Error
          ? renameError.message
          : "템플릿 이름 변경에 실패했습니다."
      );
    } finally {
      setIsRenaming(false);
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
            <li
              key={template.id}
              className="flex items-center gap-1 rounded-md border"
            >
              {renamingId === template.id ? (
                <div className="flex flex-1 items-center gap-1 px-3 py-2">
                  <Input
                    autoFocus
                    value={renameValue}
                    disabled={isRenaming}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") cancelRename();
                    }}
                    className="h-8"
                    aria-label="템플릿 이름"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={isRenaming}
                    onClick={(event) => submitRename(template.id, event)}
                    aria-label="이름 변경 저장"
                  >
                    {isRenaming ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0"
                    disabled={isRenaming}
                    onClick={cancelRename}
                    aria-label="이름 변경 취소"
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={loadingId !== null}
                    onClick={() => handleSelect(template.id)}
                    className="h-auto flex-1 justify-between px-3 py-2 text-left"
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                    onClick={(event) => startRename(template, event)}
                    aria-label={`${template.templateName} 이름 변경`}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mr-1 size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(event) => {
                      event.stopPropagation();
                      setDeleteTarget(template);
                    }}
                    aria-label={`${template.templateName} 삭제`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`"${deleteTarget?.templateName ?? ""}" 템플릿을 삭제할까요?`}
        description="삭제하면 되돌릴 수 없습니다."
        onConfirm={() => {
          if (deleteTarget) return onDelete(deleteTarget.id);
        }}
      />
    </>
  );
}

export function TemplateLoadDialog({
  open,
  onOpenChange,
  templates,
  onSelect,
  onDelete,
  onRename,
}: TemplateLoadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent onClose={() => onOpenChange(false)}>
        <TemplateLoadList
          onOpenChange={onOpenChange}
          templates={templates}
          onSelect={onSelect}
          onDelete={onDelete}
          onRename={onRename}
        />
      </DialogContent>
    </Dialog>
  );
}
