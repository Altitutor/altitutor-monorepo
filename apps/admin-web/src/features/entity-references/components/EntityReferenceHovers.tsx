"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import tippy from "tippy.js";
import { ActionSearchScope, EntityChip, Badge, Skeleton, isTypingTarget } from "@altitutor/ui";
import { statusLabel, statusToneClass } from "@/shared/utils/statusTone";
import { AttendancePersonRow } from "@/shared/components/AttendancePersonRow";
import type { ReferenceDetails } from "../types";
import { formatSessionAttendanceCount } from "@/features/sessions/utils/attendanceDerivation";
import { ReferenceActions } from './ReferenceActions';
import { ReferenceActionList } from './ReferenceActionList';
import { useContextualChipHoverActions } from './chipHoverActions';
import { openEntityReference } from '@/shared/utils/entityReference';
import type { RecordMenuAction } from '@/shared/components/recordMenuActions';

export function EntityReferencePreview({ type, id, fallbackTitle, embedded = false, onActivate, contextualActions, autoFocusSearch = false }: { type: string; id: string; fallbackTitle?: string; embedded?: boolean; onActivate?: () => void; contextualActions?: RecordMenuAction[]; autoFocusSearch?: boolean }) {
  const query = useQuery<ReferenceDetails>({
    queryKey: ["entity-reference", type, id],
    queryFn: async ({ signal }) => {
      const response = await fetch(
        `/api/entity-references/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
        { signal },
      );
      if (!response.ok) throw new Error("Preview unavailable");
      return response.json();
    },
    staleTime: 30_000,
    retry: false,
  });
  const label =
    type === "note"
      ? "Document"
      : type === "adminShift" || type === "admin-shift"
        ? "Admin shift"
        : type === "tutorLog" || type === "tutor-log"
          ? "Tutor log"
          : type.charAt(0).toUpperCase() + type.slice(1);
  return (
    <div
      data-entity-reference-preview
      role="dialog"
      aria-label={`${label} preview`}
      className={embedded ? "text-sm" : "max-h-[min(70dvh,var(--entity-preview-height,calc(100dvh-24px)))] overflow-y-auto overscroll-contain w-80 max-w-[calc(100vw-24px)] rounded-xl border bg-popover p-4 text-sm text-popover-foreground shadow-lg"}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <EntityChip entityType={type} entityId={id} label={query.data?.title || fallbackTitle || "Preview"} className="min-w-0 max-w-full font-semibold" onClick={() => {onActivate?.(); openEntityReference(type,id);}} />
        {query.data?.status && (
          <Badge className={`shrink-0 border-transparent ${statusToneClass(query.data.status)}`}>
            {statusLabel(query.data.status)}
          </Badge>
        )}
      </div>
      {query.isPending ? (
        <Skeleton className="h-12 w-full" />
      ) : query.isError ? (
        <p className="text-muted-foreground">Preview unavailable</p>
      ) : (
        <>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
          {query.data.fields.map(({ label, value }) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        {query.data.people ? (
          <div className="mt-3 space-y-3">
            {(["Student", "Staff"] as const).map((role) => {
              const members = query.data.people?.filter((person) => person.role === role) ?? [];
              if (!members.length && type !== "session") return null;
              const count = type === "session"
                ? formatSessionAttendanceCount(members, Boolean(query.data.logged))
                : members.length;
              return (
                <section key={role} className="space-y-1.5">
                  <h4 className="text-xs font-medium text-muted-foreground">{role === "Student" ? "Students" : "Staff"} ({count})</h4>
                  {!members.length ? <p className="text-xs text-muted-foreground">None</p> : null}
                  {members.map((person) => (
                    <AttendancePersonRow
                      key={`${person.role}:${person.id}`}
                      href={`/${person.role === "Student" ? "students" : "staff"}/${person.id}`}
                      name={person.name}
                      plannedStatus={person.plannedStatus}
                      actualAttended={query.data.logged ? person.actualAttended : null}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        ) : null}
        </>
      )}
      <div className="-mx-4 mt-3 border-t"><ActionSearchScope alwaysSearchable autoFocus={autoFocusSearch}>
          <ReferenceActions
            type={type}
            id={id}
            details={query.data}
            fallbackTitle={fallbackTitle}
            onActivate={onActivate}
          />
          {contextualActions?.length ? (
            <ReferenceActionList
              actions={contextualActions}
              onActivate={onActivate}
            />
          ) : null}
      </ActionSearchScope></div>
    </div>
  );
}

/** One delegated surface covers React chips and serialized mentions, including newly loaded rich text. */
export function EntityReferenceHovers() {
  const [selection, setSelection] = useState<{
    target: HTMLElement;
    pointerOpened: boolean;
    contextPoint?: DOMRect;
  } | null>(null);
  const target = selection?.target;
  const pointerOpened = selection?.pointerOpened ?? false;
  const contextPoint = selection?.contextPoint;
  const contextualActions = useContextualChipHoverActions(target?.dataset.hoverActionsKey);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    setContent(document.createElement("div"));
    const clear = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    const getChip = (event: Event) => {
      const chip = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-mention][data-id][data-type]")
        : null;
      return chip?.closest("[data-entity-reference-preview]") ? null : chip;
    };
    const enter = (event: Event) => {
      const chip = getChip(event);
      if (!chip) return;
      const previous = event instanceof MouseEvent ? event.relatedTarget : null;
      if (previous instanceof Node && chip.contains(previous)) return;
      clear();
      timer.current = setTimeout(
        () => {
          if (chip.isConnected) {
            // Layout changes can move chips under a stationary pointer while a
            // keyboard-operated resize handle still owns focus.
            const pointerOpened = event.type !== "focusin" && document.activeElement?.getAttribute("role") !== "separator";
            setSelection((current) => current?.contextPoint ? current : { target: chip, pointerOpened });
          }
        },
        0,
      );
    };
    const openContext = (event: MouseEvent) => {
      if (event.defaultPrevented || event.shiftKey) return;
      const chip = getChip(event);
      const record = event.target instanceof Element
        ? event.target.closest<HTMLElement>("[data-record-type][data-record-id]")
        : null;
      const selected = chip ?? record;
      if (!selected) return;
      event.preventDefault();
      clear();
      const contextPoint = event.button === 2 || event.clientX || event.clientY
        ? new DOMRect(event.clientX, event.clientY, 0, 0)
        : selected.getBoundingClientRect();
      setSelection({ target: selected, pointerOpened: true, contextPoint });
    };
    const leave = (event: MouseEvent) => {
      const chip =
        event.target instanceof Element
          ? event.target.closest("[data-mention]")
          : null;
      if (
        chip &&
        !(
          event.relatedTarget instanceof Node &&
          chip.contains(event.relatedTarget)
        )
      )
        clear();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        clear();
        setSelection(null);
      }
    };
    const activate = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-mention]')) {
        clear();
        setSelection(null);
      }
    };
    document.addEventListener("contextmenu", openContext);
    document.addEventListener("mouseover", enter);
    document.addEventListener("focusin", enter);
    document.addEventListener("mouseout", leave);
    document.addEventListener("keydown", escape);
    document.addEventListener('click', activate, true);
    return () => {
      clear();
      document.removeEventListener("contextmenu", openContext);
      document.removeEventListener("mouseover", enter);
      document.removeEventListener("focusin", enter);
      document.removeEventListener("mouseout", leave);
      document.removeEventListener("keydown", escape);
      document.removeEventListener('click', activate, true);
    };
  }, []);
  useEffect(() => {
    if (!target || !content) return;
    const boundary = target.closest<HTMLElement>('[role="dialog"]');
    const resize = () => content.style.setProperty('--entity-preview-height', `${Math.max(0, Math.min(window.visualViewport?.height ?? window.innerHeight, boundary?.getBoundingClientRect().height ?? window.innerHeight) - 24)}px`);
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    const observer = boundary ? new ResizeObserver(resize) : null;
    if (boundary) observer?.observe(boundary);
    let disposed = false;
    const instance = tippy(target, {
      content,
      interactive: true,
      onMount: () => {
        if (pointerOpened && !isTypingTarget(document.activeElement)) content.querySelector<HTMLInputElement>('[cmdk-input]')?.focus({preventScroll:true});
      },
      showOnCreate: true,
      ...(contextPoint && {
        trigger: "manual",
        getReferenceClientRect: () => contextPoint,
        onClickOutside: () => setSelection(null),
      }),
      placement: contextPoint ? "bottom-start" : "bottom",
      popperOptions: {modifiers:[{name:'preventOverflow',options:{boundary:boundary ?? 'clippingParents',rootBoundary:'viewport',padding:8,altAxis:true,tether:false}}]},
      appendTo: () => target.closest('[role="dialog"]') ?? document.body,
      delay: [0, 150],
      onHidden: () => {
        if (!disposed) setSelection((current) => current?.target === target ? null : current);
      },
    });
    const contentObserver = new ResizeObserver(() => { void instance.popperInstance?.update(); });
    contentObserver.observe(content);
    return () => { disposed = true; contentObserver.disconnect(); instance.destroy(); window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener('resize',resize); observer?.disconnect(); };
  }, [target, content, pointerOpened, contextPoint]);
  const type = target?.dataset.type ?? target?.dataset.recordType;
  const id = target?.dataset.id ?? target?.dataset.recordId;
  return type && id && content
    ? createPortal(<EntityReferencePreview key={`${type}:${id}:${target?.dataset.hoverActionsKey}`} autoFocusSearch={pointerOpened} type={type} id={id} fallbackTitle={target?.dataset.label} contextualActions={contextualActions} onActivate={() => setSelection(null)} />, content)
    : null;
}
