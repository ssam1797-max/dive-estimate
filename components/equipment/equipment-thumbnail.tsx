"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface EquipmentThumbnailProps {
  /** 퐁당닷컴 동기화 등으로 수집된 외부 이미지 링크. 없으면 기본 아이콘을 보여준다. */
  src: string | null | undefined;
  alt: string;
  className?: string;
}

/**
 * 장비 검색 목록·장바구니에서 품목명 왼쪽에 쓰는 45x45 썸네일.
 * image_url 이 없거나(수동 등록 품목 등) 이미지 로드에 실패하면(외부 링크가
 * 깨진 경우 등) 기본 아이콘으로 조용히 대체한다 — 레이아웃이 깨지거나
 * 브라우저 기본 "깨진 이미지" 아이콘이 노출되지 않는다.
 */
export function EquipmentThumbnail({ src, alt, className }: EquipmentThumbnailProps) {
  const [failed, setFailed] = React.useState(false);
  const showPlaceholder = !src || failed;

  return (
    <span
      className={cn(
        "flex size-[45px] shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
        className
      )}
    >
      {showPlaceholder ? (
        <ImageOff className="size-5 text-muted-foreground" aria-hidden="true" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
