"use client";

import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";

export const AdminPageActionsTarget = createContext<{ primary: HTMLDivElement | null; secondary: HTMLDivElement | null }>({ primary: null, secondary: null });

/** Keep actions owned by their feature while placing them beside the shell breadcrumb. */
export function AdminPageActions({ children, priority = "primary" }: { children: ReactNode; priority?: "primary" | "secondary" }) {
  const target = useContext(AdminPageActionsTarget)[priority];
  const accessory = useAccessoryTab();
  if (accessory) return <div className="flex flex-wrap items-center gap-2">{children}</div>;
  return target ? createPortal(<div className={`flex max-w-full flex-wrap items-center gap-2`}>{children}</div>, target) : null;
}
