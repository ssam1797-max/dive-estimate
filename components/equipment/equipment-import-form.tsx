"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandField } from "@/components/equipment/brand-field";
import { PdfDropzone } from "@/components/equipment/pdf-dropzone";
import { ImportResultSummary } from "@/components/equipment/import-result-summary";
import { uploadFormDataWithProgress } from "@/lib/http/uploadFormDataWithProgress";
import type { EquipmentImportSummary } from "@/lib/equipment/types";

interface EquipmentImportFormProps {
  initialBrands: string[];
  brandsLoadError?: boolean;
}

type UploadStatus = "idle" | "uploading" | "success" | "error";

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i);

export function EquipmentImportForm({
  initialBrands,
  brandsLoadError,
}: EquipmentImportFormProps) {
  const [brands] = React.useState(initialBrands);
  const [brand, setBrand] = React.useState(initialBrands[0] ?? "");
  const [catalogYear, setCatalogYear] = React.useState(CURRENT_YEAR);
  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const [status, setStatus] = React.useState<UploadStatus>("idle");
  const [progress, setProgress] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<EquipmentImportSummary | null>(
    null
  );

  const isUploading = status === "uploading";

  const handleFileSelect = (selected: File | null) => {
    setFile(selected);
    setFileError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSummary(null);

    if (!brand.trim()) {
      setErrorMessage("브랜드를 입력하거나 선택해주세요.");
      return;
    }

    if (!file) {
      setFileError("PDF 파일을 선택해주세요.");
      return;
    }

    if (file.type !== "application/pdf") {
      setFileError("PDF 파일만 업로드할 수 있습니다.");
      return;
    }

    setFileError(null);
    setStatus("uploading");
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append("brand", brand.trim());
      formData.append("catalogYear", String(catalogYear));
      formData.append("file", file);

      const result = await uploadFormDataWithProgress<
        EquipmentImportSummary | { error: string }
      >("/api/equipment/import", formData, setProgress);

      if ("error" in result) {
        throw new Error(result.error);
      }

      setSummary(result);
      setStatus("success");
    } catch (error) {
      console.error("장비 카탈로그 업로드 실패:", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "업로드 중 알 수 없는 오류가 발생했습니다."
      );
      setStatus("error");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>카탈로그 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {brandsLoadError && (
              <p className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                기존 브랜드 목록을 불러오지 못했습니다. 브랜드명을 직접
                입력해주세요.
              </p>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <BrandField
                brands={brands}
                value={brand}
                onChange={setBrand}
                disabled={isUploading}
              />

              <div className="flex flex-col gap-2">
                <Label htmlFor="catalog-year">발행 연도</Label>
                <Select
                  id="catalog-year"
                  value={catalogYear}
                  disabled={isUploading}
                  onChange={(event) => setCatalogYear(Number(event.target.value))}
                >
                  {YEAR_OPTIONS.map((year) => (
                    <option key={year} value={year}>
                      {year}년
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>카탈로그 PDF</Label>
              <PdfDropzone
                file={file}
                onFileSelect={handleFileSelect}
                disabled={isUploading}
                errorMessage={fileError}
              />
            </div>

            {isUploading && (
              <div className="flex flex-col gap-1.5">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  업로드 {progress}% · PDF 분석 및 AI 추출 중에는 진행률이
                  100%에 머물 수 있습니다. 잠시만 기다려주세요.
                </p>
              </div>
            )}

            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}

            <Button type="submit" disabled={isUploading} className="self-start">
              {isUploading && <Loader2 className="animate-spin" />}
              {isUploading ? "업로드 중..." : "업로드하고 자동 등록"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {status === "success" && summary && (
        <ImportResultSummary summary={summary} />
      )}
    </div>
  );
}
