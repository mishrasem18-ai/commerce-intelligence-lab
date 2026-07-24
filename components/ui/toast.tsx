"use client";

import * as React from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "error" | "info";

interface ToastOptions {
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastContextValue {
  toast: (options: ToastOptions) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const variantStyles: Record<ToastVariant, { icon: React.ReactNode; accent: string }> = {
  default: { icon: <Info className="size-4" />, accent: "text-foreground" },
  success: { icon: <CheckCircle2 className="size-4" />, accent: "text-success" },
  error: { icon: <TriangleAlert className="size-4" />, accent: "text-danger" },
  info: { icon: <Info className="size-4" />, accent: "text-primary" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const counter = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const toast = React.useCallback(
    ({ variant = "default", ...rest }: ToastOptions) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { id, variant, ...rest }]);
      window.setTimeout(() => dismiss(id), 3800);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((item) => {
          const style = variantStyles[item.variant ?? "default"];
          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto flex animate-fade-up items-start gap-3 rounded-xl border border-border bg-popover p-3.5 shadow-lg shadow-black/10"
            >
              <span className={cn("mt-0.5 shrink-0", style.accent)}>
                {style.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismiss(item.id)}
                className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
