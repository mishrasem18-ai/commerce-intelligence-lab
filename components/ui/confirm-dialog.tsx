"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  icon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Lightweight, dependency-free confirmation modal. Closes on Escape or a
 * backdrop click. Locks body scroll while open.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  React.useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden
      />
      <div className="relative w-full max-w-md animate-pop rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/20">
        <div className="flex gap-4">
          {icon && (
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5",
                tone === "danger"
                  ? "bg-danger/12 text-danger"
                  : "bg-primary/10 text-primary",
              )}
            >
              {icon}
            </span>
          )}
          <div className="min-w-0 space-y-1.5">
            <h2
              id="confirm-dialog-title"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              {title}
            </h2>
            {description && (
              <div className="text-sm text-muted-foreground">{description}</div>
            )}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "danger" : "primary"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
