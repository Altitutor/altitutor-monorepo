"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import {
  displaySettingsMatch,
  encodeViewConfig,
  readViewSettings,
  type DisplaySettings,
  type SavedView,
} from "@altitutor/shared";
import { Button } from "./button";
import { Input } from "./input";
import { Checkbox } from "./checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./dialog";
import { cn } from "../lib/cn";
import {
  toolbarControlSelectedStyles,
  toolbarControlStyles,
  toolbarControlUnselectedStyles,
} from "../lib/toolbar-control-styles";

export interface ToolbarViewDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  busy: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
}

export interface ToolbarViewsService {
  Dialog?: React.ComponentType<ToolbarViewDialogProps>;
  userId: string | null;
  shareLabel?: string;
  save: (
    view: Omit<SavedView, "id" | "created_at" | "updated_at"> & { id?: string },
  ) => Promise<SavedView>;
  remove?: (id: string) => Promise<void>;
}
const ViewsContext = React.createContext<ToolbarViewsService | null>(null);
export const ToolbarViewsProvider = ViewsContext.Provider;

function DefaultToolbarViewDialog({
  open,
  onClose,
  title,
  description,
  busy,
  children,
  footer,
}: ToolbarViewDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !busy) onClose();
      }}
    >
      <DialogContent className="flex min-h-0 max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:w-[36rem]">
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6 pr-10">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter className="shrink-0 px-6 pb-6 pt-4">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useMatchingView(
  views: SavedView[],
  current: DisplaySettings,
  defaults: DisplaySettings,
) {
  const service = React.useContext(ViewsContext);
  return views.find((view) =>
    displaySettingsMatch(
      current,
      readViewSettings(view.config, defaults, service?.userId ?? undefined),
    ),
  );
}

export function ToolbarSavedViews({
  views,
  target,
  current,
  defaults,
  onApply,
  renderEditor,
}: {
  views: SavedView[];
  target?: string;
  current: DisplaySettings;
  defaults: DisplaySettings;
  onApply: (view: SavedView) => void;
  renderEditor: (
    draft: DisplaySettings,
    onChange: (settings: DisplaySettings) => void,
  ) => React.ReactNode;
}) {
  const service = React.useContext(ViewsContext);
  const [overrides, setOverrides] = React.useState<Record<string, SavedView>>(
    {},
  );
  const [removedIds, setRemovedIds] = React.useState<Record<string, true>>({});
  const combined = [
    ...views.map((view) => overrides[view.id] ?? view),
    ...Object.values(overrides).filter(
      (view) => !views.some((item) => item.id === view.id),
    ),
  ].filter((view) => !removedIds[view.id]);
  const active = useMatchingView(combined, current, defaults);
  const [editing, setEditing] = React.useState<SavedView | "new" | null>(null);
  const [draft, setDraft] = React.useState(current);
  const [name, setName] = React.useState("");
  const [shared, setShared] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );
  const edit = (view: SavedView | "new") => {
    if (clickTimer.current) clearTimeout(clickTimer.current);
    setEditing(view);
    setName(view === "new" ? "" : view.name);
    setShared(view !== "new" && view.user_id === null);
    setDraft(
      structuredClone(
        view === "new" ? current : readViewSettings(view.config, defaults),
      ),
    );
    setError(null);
  };
  const save = async () => {
    if (!service || !editing || !target || !name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const result = await service.save({
        ...(editing === "new" ? {} : { id: editing.id }),
        name: name.trim(),
        target_entity: target,
        user_id: shared ? null : service.userId,
        config: encodeViewConfig(draft),
      });
      setOverrides((previous) => ({ ...previous, [result.id]: result }));
      setEditing(null);
      onApply(result);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not save the view.",
      );
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (
      !service?.remove ||
      !editing ||
      editing === "new" ||
      editing.id.startsWith("builtin:")
    )
      return;
    setSaving(true);
    setError(null);
    try {
      await service.remove(editing.id);
      const removedId = editing.id;
      setRemovedIds((previous) => ({ ...previous, [removedId]: true }));
      setOverrides((previous) => {
        const next = { ...previous };
        delete next[removedId];
        return next;
      });
      setEditing(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Could not delete the view.",
      );
    } finally {
      setSaving(false);
    }
  };
  const ViewDialog = service?.Dialog ?? DefaultToolbarViewDialog;
  if (!views.length && !(service && target)) return null;
  return (
    <>
      <div
        className="flex w-max flex-nowrap items-center gap-2"
        aria-label="Views"
      >
        {combined.map((view) => (
          <button
            key={view.id}
            type="button"
            aria-pressed={active?.id === view.id}
            title={
              view.id.startsWith("builtin:")
                ? "Apply default view"
                : "Click to apply; double-click to edit"
            }
            className={cn(
              "inline-flex h-8 items-center rounded-full border px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring",
              toolbarControlStyles,
              active?.id === view.id
                ? toolbarControlSelectedStyles
                : toolbarControlUnselectedStyles,
            )}
            onClick={(event) => {
              if (event.detail > 1) return;
              if (clickTimer.current) clearTimeout(clickTimer.current);
              clickTimer.current = setTimeout(() => onApply(view), 220);
            }}
            onDoubleClick={() =>
              service && !view.id.startsWith("builtin:") && edit(view)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onApply(view);
              }
              if (
                event.key === "F2" &&
                service &&
                !view.id.startsWith("builtin:")
              ) {
                event.preventDefault();
                edit(view);
              }
            }}
          >
            {view.name}
          </button>
        ))}
        {service && target ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-full text-xs"
            onClick={() => edit("new")}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            New view
          </Button>
        ) : null}
      </div>
      <ViewDialog
        open={editing !== null}
        onClose={() => {
          if (!saving) setEditing(null);
        }}
        title={editing === "new" ? "New view" : "Edit view"}
        description="Save the layout, filters, sorting, grouping and visible properties for this view."
        busy={saving}
        footer={
          <>
            {editing !== "new" && service?.remove ? (
              <Button
                type="button"
                variant="outline"
                className="mr-auto"
                disabled={saving}
                onClick={() => void remove()}
              >
                Delete view
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setEditing(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save view"}
            </Button>
          </>
        }
      >
        <div
          role="region"
          aria-label="View settings"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 pb-4"
        >
          <label className="block space-y-1 text-sm">
            View name
            <Input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Name this view"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={shared}
              onCheckedChange={(checked) => setShared(checked === true)}
            />
            {service?.shareLabel ?? "Share with all admins"}
          </label>
          {renderEditor(draft, setDraft)}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </ViewDialog>
    </>
  );
}
