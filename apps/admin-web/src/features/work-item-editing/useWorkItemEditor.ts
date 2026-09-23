"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  editOperation,
  type EditKind,
  type EditRecord,
  type EditSession,
} from "./api";

export interface RecoveryDraft {
  key: string;
  values: EditRecord;
  savedAt: string;
}
// Postgres JSON and the editor can emit identical objects in different key orders.
const signature = (value: unknown) => JSON.stringify(value, (_key, item) =>
  item && typeof item === "object" && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]))
    : item,
);
const same = (a: unknown, b: unknown) => signature(a) === signature(b);

/** Owns the entire editing lifecycle. Server refreshes never replace a writable draft. */
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
  const cache = useQueryClient();
  const [session, setSession] = useState<EditSession | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [lost, setLost] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState<RecoveryDraft[]>([]);
  const [closeRequested, setCloseRequested] = useState(false);
  const [viewSwitchRequested, setViewSwitchRequested] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const sessionRef = useRef<EditSession | null>(null);
  const baseline = useRef<T | null>(null);
  const draftKey = useRef<string | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const lostRef = useRef(false);
  const resetting = useRef(false);
  const request = useRef<{ key: string; changes: EditRecord } | null>(null);
  const pendingPreview = useRef<Promise<unknown>>(Promise.resolve());
  // Strict Mode can mount again while the previous acquisition is in flight.
  // Finish releasing that session before requesting the next one.
  const initialization = useRef<Promise<void>>(Promise.resolve());
  const options = useRef({ fromRecord, toRecord, onClose });
  options.current = { fromRecord, toRecord, onClose };
  const continuation = useRef<(() => void) | null>(null);

  const apply = useCallback(
    (next: EditSession, initial = false) => {
      sessionRef.current = next;
      setSession(next);
      if (initial || (!next.can_edit && !lostRef.current)) {
        const record = next.preview
          ? { ...next.record, ...next.preview }
          : next.record;
        const values = options.current.fromRecord(record);
        if (initial || !same(values, form.getValues())) {
          resetting.current = true;
          form.reset(values);
          resetting.current = false;
        }
        baseline.current = options.current.fromRecord(next.record);
        dirtyRef.current = false;
        setDirty(false);
      }
    },
    [form],
  );

  const preserve = useCallback(() => {
    if (!draftKey.current || !baseline.current) return;
    const values = form.getValues();
    const changed = !same(values, baseline.current);
    dirtyRef.current = changed;
    setDirty(changed);
    try {
      if (changed)
        localStorage.setItem(
          draftKey.current,
          JSON.stringify({
            values: options.current.toRecord(values),
            savedAt: new Date().toISOString(),
          }),
        );
      else localStorage.removeItem(draftKey.current);
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [form]);

  const loseSession = useCallback(
    (message: string) => {
      preserve();
      lostRef.current = true;
      setLost(true);
      setError(message);
      if (sessionRef.current) {
        sessionRef.current = { ...sessionRef.current, can_edit: false };
        setSession(sessionRef.current);
      }
    },
    [preserve],
  );

  useEffect(() => {
    if (!enabled || !id) return;
    let disposed = false;
    let busy = false;
    let heartbeatAt = 0;
    let acquired: EditSession | null = null;
    sessionRef.current = null;
    baseline.current = null;
    draftKey.current = null;
    request.current = null;
    lostRef.current = false;
    dirtyRef.current = false;
    setSession(null);
    setLost(false);
    setDirty(false);
    setError(null);
    setRecovery([]);
    const load = async () => {
      try {
        const next = await editOperation(kind, id, "acquire");
        acquired = next;
        if (disposed) {
          if (next.token) await editOperation(kind, id, "release", next.token);
          return;
        }
        const prefix = `work-draft:${next.user_id}:${kind}:${id}:`;
        const drafts: RecoveryDraft[] = [];
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith(prefix)) {
              try {
                drafts.push({ key, ...JSON.parse(localStorage.getItem(key)!) });
              } catch {
                /* Leave unreadable storage untouched. */
              }
            }
          }
        } catch {
          setStorageError(true);
        }
        setRecovery(drafts);
        draftKey.current = `${prefix}${crypto.randomUUID()}`;
        apply(next, true);
      } catch (failure) {
        if (!disposed)
          setError(
            failure instanceof Error
              ? failure.message
              : "Could not open editor.",
          );
      }
    };
    initialization.current = initialization.current.then(load);
    const timer = window.setInterval(async () => {
      const current = sessionRef.current;
      if (disposed || busy || !current || savingRef.current) return;
      if (current.can_edit && Date.now() - heartbeatAt < 10000) return;
      busy = true;
      try {
        const next = await editOperation(
          kind,
          id,
          current.can_edit ? "heartbeat" : "read",
          current.token,
        );
        if (disposed) return;
        heartbeatAt = Date.now();
        if (current.can_edit && !next.can_edit)
          loseSession("Your editing session ended. Your draft has been kept.");
        else if (!lostRef.current) {
          setError(null);
          apply(next);
        }
      } catch (failure) {
        if (!disposed) {
          if (current.can_edit)
            loseSession(
              "Connection to the editing session was lost. Your draft has been kept.",
            );
          else
            setError(
              failure instanceof Error
                ? failure.message
                : "Live preview unavailable.",
            );
        }
      } finally {
        busy = false;
      }
    }, 2000);
    return () => {
      disposed = true;
      clearInterval(timer);
      const current = sessionRef.current ?? acquired;
      if (current?.token)
        initialization.current = initialization.current.then(async () => {
          await editOperation(kind, id, "release", current.token).catch(
            () => undefined,
          );
        });
    };
  }, [kind, id, enabled, apply, loseSession]);

  useEffect(() => {
    let previewTimer: ReturnType<typeof setTimeout> | undefined;
    const subscription = form.watch(() => {
      if (resetting.current || !sessionRef.current?.can_edit) return;
      preserve();
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => {
        const current = sessionRef.current;
        if (!current?.can_edit || savingRef.current) return;
        const changes = dirtyRef.current
          ? options.current.toRecord(form.getValues())
          : null;
        pendingPreview.current = pendingPreview.current
          .then(() =>
            editOperation(kind, id, "preview", current.token, changes),
          )
          .catch(() => {
            setError("Live preview unavailable. Your draft is kept locally.");
          });
      }, 400);
    });
    return () => {
      clearTimeout(previewTimer);
      subscription.unsubscribe();
    };
  }, [form, kind, id, preserve]);

  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current || savingRef.current) {
        preserve();
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const navigate = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target.closest("a[href]")
          : null;
      if (
        !target ||
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        target.getAttribute("target") === "_blank"
      )
        return;
      const href = target.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      event.preventDefault();
      event.stopPropagation();
      continuation.current = () => {
        window.location.assign(href);
      };
      setCloseRequested(true);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [preserve]);

  const save = async () => {
    if (savingRef.current || !sessionRef.current?.can_edit || lostRef.current)
      return false;
    if (!(await form.trigger())) {
      setError("Please check the highlighted fields.");
      return false;
    }
    const values = structuredClone(form.getValues());
    const full = options.current.toRecord(values);
    const base = baseline.current
      ? options.current.toRecord(baseline.current)
      : {};
    const changes = Object.fromEntries(
      Object.entries(full).filter(([key, value]) => !same(value, base[key])),
    );
    if (!request.current || !same(request.current.changes, changes))
      request.current = { key: crypto.randomUUID(), changes };
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      await pendingPreview.current;
      const next = await editOperation(
        kind,
        id,
        "save",
        sessionRef.current.token,
        changes,
        request.current.key,
      );
      baseline.current = values;
      request.current = null;
      apply(next);
      preserve();
      void cache.invalidateQueries({
        queryKey: [kind === "document" ? "notes" : `${kind}s`],
      });
      void cache.invalidateQueries({ queryKey: ["activity", kind, id] });
      if (kind === "document")
        void cache.invalidateQueries({ queryKey: ["folders"] });
      return !dirtyRef.current;
    } catch (failure) {
      preserve();
      if ((failure as { code?: string }).code === "55P03")
        loseSession(
          "Your editing session ended. Copy your preserved draft before opening a fresh session.",
        );
      else
        setError(
          failure instanceof Error
            ? failure.message
            : "Save failed. Your draft has been kept.",
        );
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  const finishClose = async () => {
    await pendingPreview.current;
    if (sessionRef.current?.token)
      await editOperation(kind, id, "release", sessionRef.current.token).catch(
        () => undefined,
      );
    setCloseRequested(false);
    (continuation.current ?? options.current.onClose)();
    continuation.current = null;
  };
  const requestClose = (next?: () => void) => {
    if (savingRef.current) return;
    continuation.current = next ?? null;
    if (dirtyRef.current) setCloseRequested(true);
    else void finishClose();
  };
  const discard = async () => {
    if (savingRef.current) return;
    try {
      if (draftKey.current) localStorage.removeItem(draftKey.current);
    } catch {
      setStorageError(true);
    }
    dirtyRef.current = false;
    setDirty(false);
    if (baseline.current) {
      resetting.current = true;
      form.reset(baseline.current);
      resetting.current = false;
    }
    await pendingPreview.current;
    if (sessionRef.current?.can_edit)
      await editOperation(
        kind,
        id,
        "preview",
        sessionRef.current.token,
        null,
      ).catch(() => undefined);
  };
  const remove = async () => {
    if (!sessionRef.current?.can_edit || savingRef.current) return;
    savingRef.current = true;
    setDeleting(true);
    try {
      await pendingPreview.current;
      await editOperation(kind, id, "delete", sessionRef.current.token);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete this record.");
      return;
    } finally {
      savingRef.current = false;
      setDeleting(false);
    }
    try {
      if (draftKey.current) localStorage.removeItem(draftKey.current);
    } catch {
      setStorageError(true);
    }
    dirtyRef.current = false;
    void cache.invalidateQueries({
      queryKey: [kind === "document" ? "notes" : `${kind}s`],
    });
    void cache.invalidateQueries({ queryKey: ["activity", kind, id] });
    if (kind === "document")
      void cache.invalidateQueries({ queryKey: ["folders"] });
    options.current.onClose();
  };
  const acquire = async () => {
    // Never carry a stale draft into a newly acquired session.
    if (dirtyRef.current || savingRef.current) return;
    savingRef.current = true;
    setError(null);
    try {
      const next = await editOperation(kind, id, "acquire");
      lostRef.current = false;
      setLost(false);
      apply(next, true);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not acquire editing session.",
      );
    } finally {
      savingRef.current = false;
    }
  };
  const releaseToView = async () => {
    if (savingRef.current) return;
    const current = sessionRef.current;
    if (!current?.can_edit) return;
    savingRef.current = true;
    setError(null);
    try {
      await pendingPreview.current;
      if (current.token)
        await editOperation(kind, id, "release", current.token);
      const next = await editOperation(kind, id, "read");
      lostRef.current = false;
      setLost(false);
      apply(next, true);
      setViewSwitchRequested(false);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not switch to view mode.",
      );
    } finally {
      savingRef.current = false;
    }
  };
  const requestViewMode = () => {
    if (savingRef.current) return;
    if (!sessionRef.current?.can_edit) return;
    if (dirtyRef.current) setViewSwitchRequested(true);
    else void releaseToView();
  };
  const finishViewSwitch = async () => {
    setViewSwitchRequested(false);
    await releaseToView();
  };
  const restart = async () => {
    if (savingRef.current) return;
    preserve();
    if (dirtyRef.current && draftKey.current) {
      setRecovery((items) => [
        ...items,
        {
          key: draftKey.current!,
          values: options.current.toRecord(form.getValues()),
          savedAt: new Date().toISOString(),
        },
      ]);
      draftKey.current = `${draftKey.current.slice(0, draftKey.current.lastIndexOf(":") + 1)}${crypto.randomUUID()}`;
    }
    if (sessionRef.current?.token)
      await editOperation(kind, id, "release", sessionRef.current.token).catch(
        () => undefined,
      );
    dirtyRef.current = false;
    await acquire();
  };
  return {
    session,
    editable: !!session?.can_edit && !lost && !saving && !deleting,
    dirty,
    saving,
    deleting,
    lost,
    error,
    storageError,
    recovery,
    closeRequested,
    setCloseRequested,
    viewSwitchRequested,
    setViewSwitchRequested,
    save,
    discard,
    remove,
    acquire,
    requestViewMode,
    finishViewSwitch,
    restart,
    requestClose,
    finishClose,
    draft: options.current.toRecord(form.getValues()),
    dismissRecovery: (key: string) => {
      try {
        localStorage.removeItem(key);
        setRecovery((items) => items.filter((item) => item.key !== key));
      } catch {
        setStorageError(true);
      }
    },
  };
}
