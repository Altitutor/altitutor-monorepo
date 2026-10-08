"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FieldPath,
  FieldPathValue,
  FieldValues,
  UseFormReturn,
} from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useAccessoryTab } from "@/shared/contexts/AccessoryTabContext";
import {
  deleteWorkItem,
  patchWorkItem,
  readWorkItem,
  type EditKind,
  type EditRecord,
  type WorkItemSnapshot,
} from "./api";
import { workItemFormField } from "./fields";

// JSON object key order is immaterial to both Postgres and rich-text content.
const signature = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
const same = (a: unknown, b: unknown) => signature(a) === signature(b);
const isRecord = (value: unknown): value is EditRecord =>
  !!value && typeof value === "object" && !Array.isArray(value);
const textFields = new Set(["title", "name", "description", "content"]);
interface SaveRequest {
  key: string;
  changes: EditRecord;
  expected: EditRecord;
}
interface EditingState {
  disposed: boolean;
  removing: boolean;
  snapshot: WorkItemSnapshot | null;
  baseline: EditRecord;
  expected: EditRecord;
  pending: Set<string>;
  conflicts: Set<string>;
  invalid: Set<string>;
  due: Map<string, number>;
  request: SaveRequest | null;
  active: Promise<boolean> | null;
  timer?: ReturnType<typeof setTimeout>;
  storageKey: string | null;
}
const newState = (): EditingState => ({
  disposed: false,
  removing: false,
  snapshot: null,
  baseline: {},
  expected: {},
  pending: new Set(),
  conflicts: new Set(),
  invalid: new Set(),
  due: new Map(),
  request: null,
  active: null,
  storageKey: null,
});

/** User edits produce conditional field patches; loading and refreshes never save. */
export function useWorkItemEditor<T extends FieldValues>({
  kind,
  id,
  enabled = true,
  form,
  fromRecord,
  toRecord,
  onClose,
}: {
  kind: EditKind;
  id: string;
  enabled?: boolean;
  form: UseFormReturn<T>;
  fromRecord: (record: EditRecord) => T;
  toRecord: (values: T) => EditRecord;
  onClose: () => void;
}) {
  const accessoryTab = useAccessoryTab();
  const cache = useQueryClient();
  const [session, setSession] = useState<WorkItemSnapshot | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [closeRequested, setCloseRequested] = useState(false);
  const state = useRef<EditingState>(newState());
  const resetting = useRef(false);
  const options = useRef({ fromRecord, toRecord, onClose });
  options.current = { fromRecord, toRecord, onClose };
  const continuation = useRef<(() => void) | null>(null);
  const saveRef = useRef<(force?: boolean) => Promise<boolean>>(
    async () => false,
  );

  const setField = useCallback(
    (field: string, record: EditRecord) => {
      const name = workItemFormField(kind, field) as FieldPath<T>;
      const values = options.current.fromRecord(record);
      resetting.current = true;
      form.setValue(name, values[name] as FieldPathValue<T, FieldPath<T>>);
      resetting.current = false;
    },
    [form, kind],
  );

  const preserve = useCallback(
    (s: EditingState) => {
      if (s.disposed) return;
      const unsaved = s.pending.size > 0 || !!s.request;
      setDirty(unsaved);
      setConflicts([...s.conflicts]);
      if (!s.storageKey) return;
      try {
        if (unsaved) {
          const full = options.current.toRecord(form.getValues());
          const changes = Object.fromEntries(
            [...s.pending].map((field) => [field, full[field] ?? null]),
          );
          const expected = Object.fromEntries(
            [...s.pending].map((field) => [field, s.expected[field] ?? null]),
          );
          // One recovery copy per record in this tab. Restoring keeps the old
          // expectations, so it cannot overwrite content changed elsewhere.
          sessionStorage.setItem(
            s.storageKey,
            JSON.stringify({ changes, expected, request: s.request }),
          );
        } else sessionStorage.removeItem(s.storageKey);
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
    },
    [form],
  );

  const schedule = useCallback((s: EditingState) => {
    clearTimeout(s.timer);
    if (s.disposed || s.active || s.removing) return;
    const due = [...s.pending]
      .filter((field) => !s.conflicts.has(field) && !s.invalid.has(field))
      .map((field) => s.due.get(field) ?? 0);
    if (!due.length) return;
    s.timer = setTimeout(
      () => {
        void saveRef.current(false);
      },
      Math.max(0, Math.min(...due) - Date.now()),
    );
  }, []);

  const apply = useCallback(
    (s: EditingState, next: WorkItemSnapshot, submitted?: EditRecord) => {
      if (s.disposed || state.current !== s) return;
      const stale =
        Number(next.record.admin_revision ?? 0) <
        Number(s.snapshot?.record.admin_revision ?? 0);
      if (stale && !submitted) return;
      const latest = stale && s.snapshot ? s.snapshot : next;
      const full = options.current.toRecord(form.getValues());
      const normalized = options.current.toRecord(
        options.current.fromRecord(next.record),
      );
      const latestNormalized = options.current.toRecord(
        options.current.fromRecord(latest.record),
      );
      for (const field of Object.keys(normalized)) {
        if (submitted && field in submitted) {
          s.baseline[field] = normalized[field];
          s.expected[field] = next.record[field];
          if (same(full[field], submitted[field])) {
            s.pending.delete(field);
            s.invalid.delete(field);
            s.baseline[field] = latestNormalized[field];
            s.expected[field] = latest.record[field];
            // Acknowledging our own unchanged value must not rehydrate the
            // form/editor. Only an actual saved-value change needs syncing.
            if (!same(full[field], latestNormalized[field]))
              setField(field, latest.record);
          } else {
            s.pending.add(field);
          }
        } else if (!s.pending.has(field)) {
          s.baseline[field] = latestNormalized[field];
          s.expected[field] = latest.record[field];
          if (!same(full[field], latestNormalized[field]))
            setField(field, latest.record);
        }
      }
      s.snapshot = latest;
      setSession(latest);
      preserve(s);
    },
    [form, preserve, setField],
  );

  const invalidate = useCallback(() => {
    void cache.invalidateQueries({
      queryKey: [kind === "document" ? "notes" : `${kind}s`],
    });
    void cache.invalidateQueries({ queryKey: ["activity", kind, id] });
    if (kind === "document")
      void cache.invalidateQueries({ queryKey: ["folders"] });
  }, [cache, kind, id]);

  const save = useCallback(
    (force = true): Promise<boolean> => {
      const s = state.current;
      if (s.active)
        return s.active.then(() =>
          force ? saveRef.current(true) : !s.pending.size && !s.request,
        );
      if (s.disposed || !s.snapshot || s.removing)
        return Promise.resolve(false);
      clearTimeout(s.timer);
      const run = async () => {
        setSaving(true);
        setError(null);
        try {
          while (!s.disposed && !s.removing) {
            if (!s.request) {
              const fields = [...s.pending].filter(
                (field) =>
                  !s.conflicts.has(field) &&
                  !s.invalid.has(field) &&
                  (force || (s.due.get(field) ?? 0) <= Date.now()),
              );
              const valid: string[] = [];
              const full = options.current.toRecord(form.getValues());
              for (const field of fields) {
                if (
                  await form.trigger(
                    workItemFormField(kind, field) as FieldPath<T>,
                  )
                )
                  valid.push(field);
                else s.invalid.add(field);
              }
              if (s.disposed || s.removing) return false;
              const current = options.current.toRecord(form.getValues());
              const changed = valid.filter(
                (field) =>
                  s.pending.has(field) &&
                  same(full[field], current[field]) &&
                  !same(full[field], s.baseline[field]),
              );
              if (!changed.length) break;
              s.request = {
                key: crypto.randomUUID(),
                changes: Object.fromEntries(
                  changed.map((field) => [field, full[field] ?? null]),
                ),
                expected: Object.fromEntries(
                  changed.map((field) => [field, s.expected[field] ?? null]),
                ),
              };
              preserve(s);
            }
            const request = s.request;
            const next = await patchWorkItem(
              kind,
              id,
              request.changes,
              request.expected,
              request.key,
            );
            if (s.disposed) return false;
            s.request = null;
            if (next.conflicts.length) {
              for (const field of next.conflicts)
                if (s.pending.has(field)) s.conflicts.add(field);
              apply(s, next);
            } else {
              apply(s, next, request.changes);
              invalidate();
            }
            // Edits made during an HTTP request remain pending. A forced flush
            // drains them; normal autosave respects their typing debounce.
          }
          if (s.invalid.size)
            setError(
              "Please check the highlighted fields. Those changes have not been saved.",
            );
          preserve(s);
          return !s.pending.size && !s.request;
        } catch (failure) {
          if (!s.disposed) {
            setError(
              failure instanceof Error
                ? failure.message
                : "Couldn’t save. Your changes are kept in this tab.",
            );
            preserve(s);
          }
          // Keep the exact request and key: an HTTP failure may have happened
          // after the database committed. Retry it before sending newer edits.
          return false;
        } finally {
          if (!s.disposed) setSaving(false);
        }
      };
      s.active = run().finally(() => {
        s.active = null;
        if (!s.request) schedule(s);
      });
      return s.active;
    },
    [apply, form, id, invalidate, kind, preserve, schedule],
  );
  saveRef.current = save;

  useEffect(() => {
    const s = newState();
    state.current = s;
    setSession(null);
    setDirty(false);
    setSaving(false);
    setError(null);
    setConflicts([]);
    setCloseRequested(false);
    if (!enabled || !id)
      return () => {
        s.disposed = true;
      };
    const load = async () => {
      try {
        const next = await readWorkItem(kind, id);
        if (s.disposed) return;
        s.snapshot = next;
        s.baseline = options.current.toRecord(
          options.current.fromRecord(next.record),
        );
        s.expected = { ...next.record };
        s.storageKey = `work-autosave:${next.user_id}:${kind}:${id}`;
        let record = next.record;
        try {
          const recovery: unknown = JSON.parse(
            sessionStorage.getItem(s.storageKey) ?? "null",
          );
          if (
            isRecord(recovery) &&
            isRecord(recovery.changes) &&
            isRecord(recovery.expected)
          ) {
            const changed = recovery.changes;
            const previous = recovery.expected;
            const normalizedPrevious = options.current.toRecord(
              options.current.fromRecord({ ...next.record, ...previous }),
            );
            for (const field of Object.keys(s.baseline)) {
              if (!(field in changed) || !(field in previous)) continue;
              s.pending.add(field);
              s.due.set(field, Date.now());
              s.baseline[field] = normalizedPrevious[field];
              s.expected[field] = previous[field];
              record = { ...record, [field]: changed[field] };
            }
            const request = recovery.request;
            if (
              isRecord(request) &&
              typeof request.key === "string" &&
              isRecord(request.changes) &&
              isRecord(request.expected)
            ) {
              s.request = {
                key: request.key,
                changes: request.changes,
                expected: request.expected,
              };
            }
          }
        } catch {
          setStorageError(true);
        }
        resetting.current = true;
        form.reset(options.current.fromRecord(record));
        resetting.current = false;
        setSession(next);
        preserve(s);
        if (s.request) void saveRef.current(false);
        else schedule(s);
      } catch (failure) {
        if (!s.disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not open this record.",
          );
      }
    };
    void load();
    // Refresh saved properties without replacing locally edited fields.
    const poll = setInterval(() => {
      if (!s.snapshot || s.active || s.disposed || s.removing) return;
      void readWorkItem(kind, id)
        .then((next) => {
          if (!s.active) apply(s, next);
        })
        .catch(() => undefined);
    }, 10000);
    return () => {
      s.disposed = true;
      clearTimeout(s.timer);
      clearInterval(poll);
    };
  }, [apply, enabled, form, id, kind, preserve, schedule]);

  useEffect(() => {
    const subscription = form.watch((_values, info) => {
      const s = state.current;
      if (
        resetting.current ||
        s.disposed ||
        s.removing ||
        !s.snapshot ||
        !info.name
      )
        return;
      // Controller events and touched setValue calls are edits. A touched
      // setter still counts when the user returns to the original form default.
      // form.reset and programmatic hydration have no permission to save.
      const fieldState = form.getFieldState(info.name);
      if (
        info.type !== "change" &&
        !fieldState.isDirty &&
        !fieldState.isTouched
      )
        return;
      const full = options.current.toRecord(form.getValues());
      for (const field of Object.keys(full)) {
        if (workItemFormField(kind, field) !== info.name) continue;
        s.invalid.delete(field);
        if (same(full[field], s.baseline[field])) {
          s.pending.delete(field);
          s.conflicts.delete(field);
        } else {
          s.pending.add(field);
          s.due.set(field, Date.now() + (textFields.has(field) ? 600 : 0));
        }
      }
      preserve(s);
      schedule(s);
    });
    return () => subscription.unsubscribe();
  }, [form, kind, preserve, schedule]);

  const resolveConflict = (field: string, useMine: boolean) => {
    const s = state.current;
    if (!s.snapshot || !s.conflicts.has(field) || s.active) return;
    const latest = s.snapshot.record;
    s.expected[field] = latest[field];
    s.baseline[field] = options.current.toRecord(
      options.current.fromRecord(latest),
    )[field];
    s.conflicts.delete(field);
    if (!useMine) {
      setField(field, latest);
      s.pending.delete(field);
    } else s.due.set(field, Date.now());
    preserve(s);
    if (useMine) void saveRef.current(true);
  };

  const finishClose = () => {
    setCloseRequested(false);
    const next = continuation.current ?? options.current.onClose;
    continuation.current = null;
    next();
  };
  const requestClose = async (next?: () => void) => {
    const s = state.current;
    continuation.current = next ?? null;
    if (!state.current.snapshot) {
      finishClose();
      return;
    }
    const saved = await saveRef.current(true);
    if (s.disposed || state.current !== s) return;
    if (saved) finishClose();
    else setCloseRequested(true);
  };
  const closeGate = useRef(requestClose);
  closeGate.current = requestClose;
  useEffect(() => {
    if (!accessoryTab) return;
    accessoryTab.registerClose((next) => {
      void closeGate.current(next);
    });
    return () => accessoryTab.registerClose(null);
  }, [accessoryTab]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      const s = state.current;
      if (s.pending.size || s.request || s.active) {
        preserve(s);
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: MouseEvent) => {
      const s = state.current;
      if (
        accessoryTab ||
        (!s.pending.size && !s.request && !s.active) ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey ||
        event.button !== 0
      )
        return;
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      const href = target?.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        target?.getAttribute("target") === "_blank" ||
        target?.hasAttribute("download")
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      void closeGate.current(() => window.location.assign(href));
    };
    const online = () => {
      if (state.current.request || state.current.pending.size)
        void saveRef.current(true);
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("online", online);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("online", online);
      document.removeEventListener("click", navigate, true);
    };
  }, [accessoryTab, preserve]);

  const remove = async () => {
    const s = state.current;
    if (!s.snapshot || s.removing) return;
    s.removing = true;
    setDeleting(true);
    if (s.active) await s.active;
    if (s.disposed) return;
    clearTimeout(s.timer);
    try {
      await deleteWorkItem(kind, id);
      if (s.disposed) return;
      s.pending.clear();
      s.request = null;
      preserve(s);
      invalidate();
      options.current.onClose();
    } catch (failure) {
      if (!s.disposed)
        setError(
          failure instanceof Error
            ? failure.message
            : "Could not delete this record.",
        );
    } finally {
      s.removing = false;
      if (!s.disposed) {
        setDeleting(false);
        schedule(s);
      }
    }
  };

  return {
    session,
    editable: !!session && !deleting,
    dirty,
    saving,
    deleting,
    error,
    storageError,
    conflicts,
    closeRequested,
    setCloseRequested,
    save,
    remove,
    requestClose,
    finishClose,
    resolveConflict,
  };
}
