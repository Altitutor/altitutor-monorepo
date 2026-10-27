"use client";

import { useCallback, useRef, useState } from "react";
import { randomUuid } from "@altitutor/ui/lib/random-uuid";
import type { InterviewCatalog, InterviewTemplate } from "@altitutor/shared";
import { Printer } from "lucide-react";
import { UcatDialogShell } from "@/features/ucat/shared/dialog-shell";
import { UcatRowActions } from "@/features/ucat/shared/row-actions";
import {
  BuilderEditor,
  type InterviewEditorBind,
} from "./InterviewBuilder";
import { InterviewPrintDialog } from "./InterviewPrintDialog";

export function createBlankInterview(): InterviewTemplate {
  return {
    id: randomUuid(),
    version: 0,
    name: "Untitled interview",
    readingTimeSeconds: 120,
    questionTimeSeconds: 480,
    recordingEnabled: false,
    stations: [],
    archived: false,
    updatedAt: "",
  };
}

export function InterviewEditorDialog({
  original,
  catalog,
  mode,
  onClose,
  onSaved,
}: {
  original: InterviewTemplate | null;
  catalog: InterviewCatalog;
  mode: "create" | "edit";
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const saveRef = useRef<() => Promise<void>>(async () => undefined);
  const [canSave, setCanSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [canPrint, setCanPrint] = useState(false);
  const [printing, setPrinting] = useState(false);
  const onBind = useCallback((state: InterviewEditorBind) => {
    saveRef.current = state.save;
    setCanSave((previous) =>
      previous === state.canSave ? previous : state.canSave,
    );
    setSaving((previous) =>
      previous === state.saving ? previous : state.saving,
    );
    setCanPrint((previous) =>
      previous === state.canPrint ? previous : state.canPrint,
    );
  }, []);

  return (
    <UcatDialogShell
      open={!!original}
      onClose={onClose}
      title={mode === "create" ? "New interview" : original?.name || "Edit interview"}
      subtitle="Assemble whole stations from the station bank and configure shared timing."
      onSave={() => void saveRef.current().catch(() => undefined)}
      saveLabel="Save interview"
      saveDisabled={!canSave}
      isSaving={saving}
      headerActions={
        mode === "edit" && original ? (
          <UcatRowActions
            actions={[
              {
                label: "Print prompts",
                description: canPrint
                  ? undefined
                  : "Save the interview with at least one station before printing",
                icon: <Printer className="h-4 w-4" />,
                onClick: () => {
                  if (!canPrint) return;
                  setPrinting(true);
                },
              },
            ]}
          />
        ) : null
      }
      defaultExpanded
    >
      {original ? (
        <div className="h-full min-h-0 overflow-hidden">
          <BuilderEditor
            key={original.id}
            original={original}
            catalog={catalog}
            embedded
            onBind={onBind}
            onSaved={onSaved}
          />
        </div>
      ) : (
        <div />
      )}
      {original ? (
        <InterviewPrintDialog
          interview={printing ? original : null}
          catalog={catalog}
          onClose={() => setPrinting(false)}
        />
      ) : null}
    </UcatDialogShell>
  );
}
