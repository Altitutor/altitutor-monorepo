"use client";

import * as React from "react";
import { Toaster, toast as sonnerToast } from "sonner";

export interface ToastInput {
  title?: string;
  description?: React.ReactNode;
  action?: { label: string; onClick: () => void };
  variant?: "default" | "destructive";
  duration?: number;
}

interface ToastContextValue {
  toast: (props: ToastInput) => void;
  dismiss: (toastId?: string | number) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

function mapLegacyToastToSonner(input: ToastInput): void {
  const { title, description, action, variant, duration } = input;
  const actionOption = action
    ? { label: action.label, onClick: () => action.onClick() }
    : undefined;

  const durationOption =
    duration === undefined
      ? {}
      : { duration: duration === Infinity ? Infinity : duration };

  const opts = {
    ...durationOption,
    ...(actionOption ? { action: actionOption } : {}),
  };

  const trimmedTitle = title?.trim();
  const hasTitle = Boolean(trimmedTitle);

  if (variant === "destructive") {
    if (hasTitle) {
      sonnerToast.error(trimmedTitle!, {
        ...opts,
        description: description ?? undefined,
      });
      return;
    }
    const body =
      description !== undefined && description !== null && description !== ""
        ? description
        : "Something went wrong";
    sonnerToast.error(body as string | React.ReactNode, opts);
    return;
  }

  if (hasTitle) {
    sonnerToast(trimmedTitle!, {
      ...opts,
      description: description ?? undefined,
    });
    return;
  }

  sonnerToast((description ?? "") as React.ReactNode, opts);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toast = React.useCallback((props: ToastInput) => {
    mapLegacyToastToSonner(props);
  }, []);

  const dismiss = React.useCallback((toastId?: string | number) => {
    sonnerToast.dismiss(toastId);
  }, []);

  const value = React.useMemo(
    () => ({ toast, dismiss }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toaster
        position="top-right"
        theme="system"
        closeButton
        className="toaster group"
        toastOptions={{
          classNames: {
            toast: "border-border bg-card text-card-foreground shadow-lg",
            title: "text-foreground",
            description: "text-muted-foreground",
            actionButton:
              "bg-primary text-primary-foreground hover:bg-primary/90",
            cancelButton: "bg-muted text-muted-foreground hover:bg-muted/80",
            closeButton:
              "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            default: "border-border bg-card text-card-foreground",
            success: "border-primary/35 bg-primary text-primary-foreground",
            info: "border-secondary/35 bg-secondary text-secondary-foreground",
            warning: "border-accent/35 bg-accent text-accent-foreground",
            error:
              "border-destructive/40 bg-destructive text-destructive-foreground",
          },
        }}
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
