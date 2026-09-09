"use client";

import * as React from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MAX_PDF_FILE_SIZE_BYTES } from "@/lib/equipment/constants";

interface PdfDropzoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
  errorMessage?: string | null;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * PDF 전용 드래그 앤 드롭 업로드 영역.
 * (react-dropzone 등 외부 라이브러리 없이 HTML5 Drag & Drop API 로 직접 구현)
 */
export function PdfDropzone({
  file,
  onFileSelect,
  disabled,
  errorMessage,
}: PdfDropzoneProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const selected = fileList[0];

    if (selected.type !== "application/pdf") {
      onFileSelect(null);
      return;
    }

    onFileSelect(selected);
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        onKeyDown={(event) => {
          if (!disabled && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex min-h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors",
          isDragging
            ? "border-primary bg-accent"
            : "border-input hover:bg-accent/50",
          disabled && "pointer-events-none opacity-50",
          errorMessage && "border-destructive"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(event) => handleFiles(event.target.files)}
        />

        {file ? (
          <div className="flex w-full items-center justify-between gap-3 rounded-md bg-background/60 p-3 text-left">
            <div className="flex min-w-0 items-center gap-2">
              <FileText className="size-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={(event) => {
                event.stopPropagation();
                onFileSelect(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              aria-label="선택한 파일 제거"
            >
              <X className="size-4" />
            </Button>
          </div>
        ) : (
          <>
            <UploadCloud className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              카탈로그 PDF 파일을 여기로 드래그하거나 클릭해서 선택하세요
            </p>
            <p className="text-xs text-muted-foreground">PDF 파일, 최대 {MAX_PDF_FILE_SIZE_BYTES / (1024 * 1024)}MB</p>
          </>
        )}
      </div>

      {errorMessage && (
        <p className="text-sm text-destructive">{errorMessage}</p>
      )}
    </div>
  );
}
