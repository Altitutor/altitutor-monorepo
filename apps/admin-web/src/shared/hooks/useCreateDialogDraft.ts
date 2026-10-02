"use client";

import { useCallback, useEffect } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useAuthStore } from "@/shared/lib/supabase/auth";

const sessionDrafts = new Map<string, FieldValues>();

/** Creation drafts stay in this browser session, including across page navigation. */
export function useCreateDialogDraft<T extends FieldValues>(
  form: UseFormReturn<T>,
  isOpen: boolean,
  key: string,
) {
  const userId = useAuthStore((state) => state.user?.id);
  const storageKey = `admin-create-draft-v1:${userId ?? "anonymous"}:${key}`;
  const readDraft = useCallback((): T | undefined => {
    try {
      const value: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) ?? "null",
      );
      if (value && typeof value === "object" && !Array.isArray(value))
        return value as T;
    } catch {
      /* In-memory drafts still work if browser storage is blocked. */
    }
    return sessionDrafts.get(storageKey) as T | undefined;
  }, [storageKey]);
  const saveDraft = useCallback(() => {
    const values = form.getValues();
    sessionDrafts.set(storageKey, values);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(values));
    } catch {
      /* Keep the session copy. */
    }
  }, [form, storageKey]);
  const clearDraft = useCallback(() => {
    sessionDrafts.delete(storageKey);
    try {
      sessionStorage.removeItem(storageKey);
    } catch {
      /* Storage may be unavailable. */
    }
  }, [storageKey]);
  useEffect(() => {
    if (!isOpen) return;
    const subscription = form.watch(saveDraft);
    return () => subscription.unsubscribe();
  }, [isOpen, form, saveDraft]);
  return { readDraft, saveDraft, clearDraft, storageKey };
}
