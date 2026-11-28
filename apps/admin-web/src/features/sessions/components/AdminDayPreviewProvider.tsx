"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";
import { SmartDatePickerDayPreviewProvider } from "@altitutor/ui";

const DaySessionPreview = dynamic(
  () => import("./DaySessionPreview").then(module => module.DaySessionPreview),
  { loading: () => <p role="status" className="text-xs text-muted-foreground">Loading day preview…</p> },
);

export function AdminDayPreviewProvider({ children }: { children: ReactNode }) {
  return <SmartDatePickerDayPreviewProvider preview={DaySessionPreview}>{children}</SmartDatePickerDayPreviewProvider>;
}
