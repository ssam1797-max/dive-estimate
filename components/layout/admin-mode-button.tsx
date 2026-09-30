"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Lock, LockOpen } from "lucide-react";

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
import { useAdminMode } from "@/components/layout/admin-mode-context";

/**
 * 전역 내비게이션에 항상 떠 있는 관리자 모드 버튼. 원가/브랜드 할인율/장비
 * 등록·동기화 등 관리자 전용 기능은 이 모드가 켜져 있을 때만 접근할 수 있다.
 * 로그인/로그아웃 성공 시 router.refresh() 로 서버(RootLayout)에서 쿠키를
 * 다시 읽어 AdminModeProvider 값을 갱신한다.
 */
export function AdminModeButton() {
  const isAdmin = useAdminMode();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? "로그인에 실패했습니다.");
      }
      setOpen(false);
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "로그인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  if (isAdmin) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={loading}
        onClick={handleLogout}
        className="ml-auto shrink-0 gap-1.5 whitespace-nowrap"
      >
        {loading ? <Loader2 className="size-3.5 animate-spin" /> : <LockOpen className="size-3.5" />}
        관리자 모드
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="ml-auto shrink-0 gap-1.5 whitespace-nowrap text-muted-foreground"
      >
        <Lock className="size-3.5" />
        관리자 모드
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setPassword("");
            setError(null);
          }
        }}
      >
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>관리자 모드</DialogTitle>
            <DialogDescription>
              원가 확인, 브랜드 할인율 수정, 장비 등록/동기화는 관리자 모드에서만 이용할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <Input
              type="password"
              autoFocus
              value={password}
              disabled={loading}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="관리자 비밀번호"
              aria-label="관리자 비밀번호"
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="submit" disabled={loading || !password}>
                {loading && <Loader2 className="animate-spin" />}
                확인
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
