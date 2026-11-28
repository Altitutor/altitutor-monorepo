"use client";

import { useState } from "react";
import type { FieldValues } from "react-hook-form";
import { useWorkItemEditor } from "./useWorkItemEditor";

type EditorOptions<T extends FieldValues> = Parameters<typeof useWorkItemEditor<T>>[0];

/** Owns display readiness without hydrating joined metadata into the edit form. */
export function useWorkItemDetail<T extends FieldValues, R extends { id: string }>(
  options: EditorOptions<T> & {
    detail: { data: R | null | undefined; isLoading: boolean };
    title: string | null | undefined;
  },
) {
  const { detail, title, ...editorOptions } = options;
  const { id, kind, enabled = true } = editorOptions;
  const editor = useWorkItemEditor(editorOptions);
  const identity = `${kind}:${id}`;
  const [retained, setRetained] = useState<{ identity: string; record: R } | null>(null);
  // Reset during render: effects would expose the previous record for one render.
  if (retained && (retained.identity !== identity || !enabled)) setRetained(null);
  const current = enabled && detail.data?.id === id ? detail.data : null;
  if (current && (retained?.identity !== identity || retained.record !== current))
    setRetained({ identity, record: current });

  const hasSession = enabled && editor.session?.record.id === id;
  const record = hasSession
    ? current ?? (retained?.identity === identity ? retained.record : null)
    : null;
  const unavailable = enabled && editor.unavailable;
  return {
    // Metadata is display-only. The editor remains authoritative for local edits.
    record,
    title: hasSession ? title : undefined,
    isLoading: enabled && (detail.isLoading || (!hasSession && !unavailable)),
    editor: {
      ...editor,
      session: hasSession ? editor.session : null,
      editable: hasSession && editor.editable,
      unavailable,
    },
  };
}
