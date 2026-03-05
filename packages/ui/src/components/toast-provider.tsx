"use client";

import * as React from "react";
import { Toaster, type ToastData } from "./toaster";

interface ToastContextValue {
  toasts: ToastData[];
  toast: (props: {
    title?: string;
    description?: React.ReactNode;
    variant?: "default" | "destructive";
    duration?: number;
  }) => void;
  dismiss: (id: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(
  undefined
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);

  const toast = React.useCallback(
    (props: {
      title?: string;
      description?: React.ReactNode;
      variant?: "default" | "destructive";
      duration?: number;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastData = {
        id,
        title: props.title,
        description: props.description,
        variant: props.variant || "default",
      };

      setToasts((prevToasts) => [...prevToasts, newToast]);

      // Auto dismiss
      if (props.duration !== Infinity) {
        setTimeout(() => {
          setToasts((prevToasts) =>
            prevToasts.filter((toast) => toast.id !== id)
          );
        }, props.duration || 5000);
      }
    },
    []
  );

  const dismiss = React.useCallback((id: string) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, toast, dismiss }}>
      {children}
      <Toaster toasts={toasts} onDismiss={dismiss} />
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

