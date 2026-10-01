"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EstimateBuilder } from "@/components/estimates/estimate-builder";

type EstimateBuilderProps = React.ComponentProps<typeof EstimateBuilder>;

interface EstimateEditGateProps {
  estimateId: string;
  /**
   * EstimateBuilder 에 그대로 전달할 props. editContext 는 반드시 있어야
   * 하며(이 게이트는 "이어서 수정" 전용), 비밀번호 확인이 끝나면 그 값을
   * currentPassword 로 채워 넣는다.
   */
  builderProps: Omit<EstimateBuilderProps, "editContext"> & {
    editContext: NonNullable<EstimateBuilderProps["editContext"]>;
  };
}

/**
 * 비밀번호로 보호된 견적서를 "이어서 수정"할 때 먼저 보여주는 화면.
 * 수정 가능한 폼을 바로 띄우지 않고(= 열람은 읽기 전용), 비밀번호를 확인한
 * 뒤에만 실제 EstimateBuilder(수정 화면)를 그린다 — 틀린 비밀번호로 한참
 * 수정하다가 저장 시점에야 거절당하는 일이 없도록 먼저 가볍게 검증한다.
 *
 * (Server Component 인 app/estimates/[id]/edit/page.tsx 에서 함수를 children
 * 으로 넘길 수 없어 — RSC 경계를 넘는 props 는 직렬화 가능해야 한다 —
 * EstimateBuilder 를 render prop 대신 이 Client Component 안에서 직접 렌더링한다.)
 */
export function EstimateEditGate({ estimateId, builderProps }: EstimateEditGateProps) {
  const [password, setPassword] = React.useState("");
  const [verifiedPassword, setVerifiedPassword] = React.useState<string | null>(null);
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsVerifying(true);
    setError(null);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/verify-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { error?: string }).error ?? "비밀번호 확인에 실패했습니다.");
      }
      setVerifiedPassword(password);
    } catch (verifyError) {
      setError(
        verifyError instanceof Error ? verifyError.message : "비밀번호 확인 중 오류가 발생했습니다."
      );
    } finally {
      setIsVerifying(false);
    }
  };

  if (verifiedPassword !== null) {
    return (
      <EstimateBuilder
        {...builderProps}
        editContext={{ ...builderProps.editContext, currentPassword: verifiedPassword }}
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="size-4" />
          비밀번호로 보호된 견적서
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          이 견적서를 수정하려면 저장할 때 설정한 비밀번호를 입력하세요. 내용만
          확인하려면 비밀번호 없이{" "}
          <Link href={`/estimates/${estimateId}/print`} className="underline" target="_blank">
            읽기 전용으로 보기
          </Link>
          를 이용하세요.
        </p>
        <form onSubmit={handleSubmit} className="flex max-w-xs flex-col gap-2">
          <Input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={6}
            value={password}
            disabled={isVerifying}
            onChange={(event) => setPassword(event.target.value.replace(/\D/g, ""))}
            placeholder="견적서 비밀번호"
            aria-label="견적서 비밀번호"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={isVerifying || !password} className="self-start">
            {isVerifying && <Loader2 className="animate-spin" />}
            확인
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
