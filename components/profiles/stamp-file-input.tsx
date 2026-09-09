"use client";

import * as React from "react";
import { Stamp, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const MAX_STAMP_FILE_SIZE_BYTES = 1.5 * 1024 * 1024; // 1.5MB

interface StampFileInputProps {
  /** 현재 저장된(또는 방금 선택한) 도장 이미지. base64 data URI 문자열. */
  value: string;
  onChange: (dataUri: string) => void;
  disabled?: boolean;
}

/**
 * 도장(인감) 이미지 파일 업로드 입력.
 * URL 을 직접 타이핑하는 대신 로컬 이미지 파일(PNG/JPG)을 선택하면
 * base64 data URI 로 인코딩해 그대로 프로필의 stampUrl 필드에 담는다.
 */
export function StampFileInput({ value, onChange, disabled }: StampFileInputProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);

  const handleFileSelect = (fileList: FileList | null) => {
    const file = fileList?.[0];
    if (!file) return;

    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일(PNG, JPG 등)만 업로드할 수 있습니다.");
      return;
    }

    if (file.size > MAX_STAMP_FILE_SIZE_BYTES) {
      setError(
        `파일 용량이 너무 큽니다. 최대 ${Math.round(MAX_STAMP_FILE_SIZE_BYTES / (1024 * 1024))}MB까지 업로드할 수 있습니다.`
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onChange(reader.result);
      }
    };
    reader.onerror = () => {
      setError("파일을 읽는 중 오류가 발생했습니다.");
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    onChange("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="profile-stamp-file">도장(인감) 이미지</Label>

      <div className="flex items-center gap-3">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40">
          {value ? (
            // 사용자가 로컬에서 고른 이미지를 즉시 미리보기 하는 용도라
            // next/image 최적화 파이프라인(원격 로더)이 필요 없다.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="도장 미리보기" className="size-full object-contain" />
          ) : (
            <Stamp className="size-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id="profile-stamp-file"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={disabled}
              onChange={(event) => handleFileSelect(event.target.files)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="size-4" />
              {value ? "다른 파일 선택" : "파일 선택"}
            </Button>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={handleRemove}
              >
                <X className="size-4" />
                제거
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG 등 이미지 파일. 최대{" "}
            {Math.round(MAX_STAMP_FILE_SIZE_BYTES / (1024 * 1024))}MB. 비워두면
            견적서에 기본 MOCK 도장이 대신 표시됩니다.
          </p>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
