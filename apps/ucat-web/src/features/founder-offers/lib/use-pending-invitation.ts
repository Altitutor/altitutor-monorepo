"use client";
import { useEffect, useState } from "react";
import { pendingInvitation, rememberInvitation } from "./pending-invitation";
export function usePendingInvitation(initialCode?: string | null) {
  const [code, setCode] = useState(initialCode ?? null);
  useEffect(() => {
    if (initialCode) rememberInvitation(initialCode);
    setCode(initialCode ?? pendingInvitation());
  }, [initialCode]);
  return [code, setCode] as const;
}
