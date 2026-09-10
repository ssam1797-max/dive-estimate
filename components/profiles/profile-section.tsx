"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ProfileFormDialog,
  type ProfileFormValues,
} from "@/components/profiles/profile-form-dialog";
import type { ProfileOption } from "@/lib/estimates/types";

interface ProfileSectionProps {
  type: "PROVIDER" | "RECEIVER";
  title: string;
  description: string;
  initialProfiles: ProfileOption[];
}

export function ProfileSection({
  type,
  title,
  description,
  initialProfiles,
}: ProfileSectionProps) {
  const [profiles, setProfiles] = React.useState(initialProfiles);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingProfile, setEditingProfile] = React.useState<ProfileOption | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ProfileOption | null>(null);

  const openCreateDialog = () => {
    setEditingProfile(null);
    setDialogOpen(true);
  };

  const openEditDialog = (profile: ProfileOption) => {
    setEditingProfile(profile);
    setDialogOpen(true);
  };

  const handleSubmit = async (values: ProfileFormValues) => {
    const isEdit = Boolean(editingProfile);
    const response = await fetch(
      isEdit ? `/api/profiles/${editingProfile!.id}` : "/api/profiles",
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, ...values }),
      }
    );

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body?.error ?? "저장에 실패했습니다.");
    }

    const saved = body.profile as ProfileOption;
    setProfiles((prev) =>
      isEdit
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name, "ko"))
    );
  };

  const handleDelete = async (profile: ProfileOption) => {
    setError(null);
    try {
      const response = await fetch(`/api/profiles/${profile.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "삭제에 실패했습니다.");
      }
      setProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "삭제 중 오류가 발생했습니다.";
      setError(message);
      throw deleteError;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" size="sm" onClick={openCreateDialog}>
          <Plus className="size-4" />
          새로 등록
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {error && <p className="text-sm text-destructive">{error}</p>}

        {profiles.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            등록된 {type === "PROVIDER" ? "공급자" : "공급받는자"}가 없습니다.
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {profiles.map((profile) => (
              <li
                key={profile.id}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{profile.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[profile.contact, profile.representative && `대표 ${profile.representative}`]
                      .filter(Boolean)
                      .join(" · ") || "-"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${profile.name} 수정`}
                    onClick={() => openEditDialog(profile)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${profile.name} 삭제`}
                    onClick={() => setDeleteTarget(profile)}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <ProfileFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={type}
        editingProfile={editingProfile}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`"${deleteTarget?.name ?? ""}"을(를) 삭제할까요?`}
        onConfirm={() => {
          if (deleteTarget) return handleDelete(deleteTarget);
        }}
      />
    </Card>
  );
}
