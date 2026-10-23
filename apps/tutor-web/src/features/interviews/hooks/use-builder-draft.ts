"use client";

import { useEffect, useState } from "react";
import type { InterviewTemplate } from "@altitutor/shared";

export function useBuilderDraft(actorId: string, original: InterviewTemplate) {
  const key = `interview-builder:v2:${actorId}:${original.id}`;
  const [state, setState] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key);
      const saved = raw
        ? (JSON.parse(raw) as { draft: InterviewTemplate; version: number })
        : null;
      if (saved?.draft.id === original.id && typeof saved.version === "number")
        return { ...saved, dirty: true, recovered: true };
    } catch {
      /* An unavailable browser store must not prevent editing. */
    }
    return {
      draft: original,
      version: original.version,
      dirty: false,
      recovered: false,
    };
  });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    try {
      if (state.dirty)
        sessionStorage.setItem(
          key,
          JSON.stringify({ draft: state.draft, version: state.version }),
        );
      else sessionStorage.removeItem(key);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [key, state]);
  const conflict = state.dirty && state.version !== original.version;
  return {
    draft: state.dirty
      ? state.draft
      : original.version > state.version
        ? original
        : state.draft,
    version: state.dirty
      ? state.version
      : Math.max(original.version, state.version),
    dirty: state.dirty,
    recovered: state.recovered,
    conflict,
    storageError,
    change: (draft: InterviewTemplate) =>
      setState((previous) => ({
        ...previous,
        draft,
        dirty: true,
        version: previous.dirty
          ? previous.version
          : Math.max(previous.version, original.version),
      })),
    saved: (version: number, submitted: InterviewTemplate) =>
      setState((previous) => ({
        ...previous,
        draft: { ...previous.draft, version },
        version,
        dirty: previous.draft !== submitted,
        recovered: false,
      })),
    discard: () =>
      setState({
        draft: original,
        version: original.version,
        dirty: false,
        recovered: false,
      }),
  };
}
