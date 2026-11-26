"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PartnerForm } from "@/components/erp/partner-form";

export function NewPartnerButton() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>+ 거래처 추가</Button>
      <Dialog open={open} onOpenChange={setOpen} widthClassName="max-w-2xl">
        <DialogContent onClose={() => setOpen(false)}>
          <DialogHeader>
            <DialogTitle>거래처 추가</DialogTitle>
          </DialogHeader>
          <PartnerForm
            onDone={(id) => {
              setOpen(false);
              router.push(`/erp/partners/${id}`);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
