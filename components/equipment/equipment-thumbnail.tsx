"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

interface EquipmentThumbnailProps {
  /** 퐁당닷컴 동기화 등으로 수집된 외부 이미지 링크. 없으면 기본 아이콘을 보여준다. */
  src: string | null | undefined;
  alt: string;
  /** 기본 45x45 크기를 바꾸고 싶을 때(예: 담기 확인 모달의 큰 미리보기) 전달. */
  className?: string;
  /** 대체 아이콘 크기 클래스. 썸네일을 키울 때(className) 같이 키워주지 않으면 아이콘이 너무 작아 보인다. */
  iconClassName?: string;
}

/**
 * 장비 검색 목록·장바구니에서 품목명 왼쪽에 쓰는 45x45 썸네일(className으로
 * 더 크게도 쓸 수 있음 — 담기 확인 모달의 큰 미리보기 등).
 * image_url 이 없거나(수동 등록 품목 등) 이미지 로드에 실패하면(외부 링크가
 * 깨진 경우 등) 기본 아이콘으로 조용히 대체한다 — 레이아웃이 깨지거나
 * 브라우저 기본 "깨진 이미지" 아이콘이 노출되지 않는다.
 */
export function EquipmentThumbnail({
  src,
  alt,
  className,
  iconClassName = "size-5",
}: EquipmentThumbnailProps) {
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
        <ImageOff className={cn("text-muted-foreground", iconClassName)} aria-hidden="true" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="size-full object-cover"
          // loading="lazy" 였을 때 썸네일이 화면에 분명히 보이는 상태에서도
          // naturalWidth=0/complete=false 로 영영 멈춰(요청 자체가 발생하지
          // 않음) 실제로 로드되지 않는 현상이 실측으로 확인됐다 — 45x45의
          // 아주 작은 이미지라 지연 로딩으로 아낄 성능 이득도 크지 않아,
          // 신뢰성을 위해 즉시(eager) 로드한다.
          // 퐁당닷컴이 Referer 헤더를 보고 외부 핫링크를 막는 경우를 대비해
          // Referer 자체를 아예 보내지 않는다(이미지 요청에 한정 — 사이트
          // 식별 정보 유출과는 무관). 그래도 막혀서 로드가 실패하면 onError
          // 로 기본 아이콘으로 대체한다.
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
