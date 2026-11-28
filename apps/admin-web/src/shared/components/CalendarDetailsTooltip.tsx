"use client";

import { useCallback, useEffect, useRef, useState, useId, type ReactNode } from "react";
import { EntityReferencePreview } from "@/features/entity-references/components/EntityReferenceHovers";
import Link from "next/link";
import { AttendancePersonRow } from "@/shared/components/AttendancePersonRow";
import type { Tables } from "@altitutor/shared";
import {
  Badge,
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
  entityReferenceDragProps,
} from "@altitutor/ui";
import { getSubjectColorStyle, formatSessionType, cn } from "@/shared/utils";
import { statusToneClass } from "@/shared/utils/statusTone";
import {
  deriveStudentAttendanceStatus,
  deriveStaffAttendanceStatus,
  formatSessionAttendanceCount,
  type StudentAttendanceInput,
  type StaffAttendanceInput,
} from "@/features/sessions/utils/attendanceDerivation";

export type CalendarPerson = {
  id: string;
  first_name: string;
  last_name: string;
  enrolled_at?: string | null;
};
export type CalendarStudent = CalendarPerson & StudentAttendanceInput;
export type CalendarStaff = CalendarPerson &
  StaffAttendanceInput & { is_swapped_in?: boolean };

const openCalendarDetails = new WeakMap<Document, () => void>();
const detailsCollisionPadding = 8;

function detailsSide(anchor: HTMLElement): "right" | "bottom" {
  const { documentElement, defaultView } = anchor.ownerDocument;
  const viewportWidth = documentElement.clientWidth;
  if (!viewportWidth) return "right";

  const { left, right } = anchor.getBoundingClientRect();
  const rootFontSize = Number.parseFloat(defaultView?.getComputedStyle(documentElement).fontSize ?? "") || 16;
  // Keep the declared 20rem width when either horizontal side can fit the card.
  const detailsWidth = Math.min(20 * rootFontSize, viewportWidth - 24);
  const hasRoomOnEitherSide = Math.max(left, viewportWidth - right) >= detailsWidth + detailsCollisionPadding + 4;
  return hasRoomOnEitherSide ? "right" : "bottom";
}

const label = (value: string) =>
  value
    .replace(/[-_]/g, " ")
    .toLowerCase()
    .replace(/^./, (c) => c.toUpperCase());

export function CalendarDetailsTooltip({
  enabled,
  title,
  subtitle,
  status,
  students,
  staff,
  attendance = false,
  hasTutorLog = false,
  children,
  subject,
  sessionType,
  openEntity,
  referenceDrag,
}: {
  enabled: boolean;
  title: string;
  subtitle: ReactNode;
  status?: string | null;
  students?: CalendarStudent[];
  staff: CalendarStaff[];
  attendance?: boolean;
  hasTutorLog?: boolean;
  children: ReactNode;
  subject?: Tables<"subjects">;
  sessionType?: string | null;
  openEntity?: { href: string; label: string };
  referenceDrag?: Parameters<typeof entityReferenceDragProps>[0];
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"right" | "bottom">("right");
  const contentId = useId();
  const instructionsId = useId();
  const triggerHovered = useRef(false);
  const contentHovered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cancel = () => clearTimeout(timer.current);
  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);
  const updateOpen = (next: boolean) => {
    const anchor = triggerRef.current;
    if (next && anchor) setSide(detailsSide(anchor));
    const document = anchor?.ownerDocument;
    if (document) {
      const current = openCalendarDetails.get(document);
      if (next && current !== dismiss) {
        current?.();
        openCalendarDetails.set(document, dismiss);
      } else if (!next && current === dismiss) {
        openCalendarDetails.delete(document);
      }
    }
    setOpen(next);
  };
  useEffect(() => {
    const document = triggerRef.current?.ownerDocument;
    return () => {
      clearTimeout(timer.current);
      if (document && openCalendarDetails.get(document) === dismiss) {
        openCalendarDetails.delete(document);
      }
    };
  }, [dismiss, enabled]);
  const show = () => {
    cancel();
    timer.current = setTimeout(() => updateOpen(true), 250);
  };
  const hide = () => {
    cancel();
    timer.current = setTimeout(() => {
      const focused = document.activeElement;
      if (
        triggerHovered.current ||
        contentHovered.current ||
        triggerRef.current?.contains(focused) ||
        contentRef.current?.contains(focused)
      )
        return;
      updateOpen(false);
    }, 200);
  };
  useEffect(() => {
    if (!open) contentHovered.current = false;
  }, [open]);
  const blur = (event: React.FocusEvent) => {
    const target = event.relatedTarget as Node | null;
    if (
      target &&
      (triggerRef.current?.contains(target) ||
        contentRef.current?.contains(target))
    )
      return;
    hide();
  };
  if (!enabled) return <>{children}</>;
  const subjectColor = getSubjectColorStyle(subject);
  const plannedStudentIds = new Set(
    students?.filter((student) => student.sessions_students_id).map((student) => student.id),
  );
  const people = (
    members: CalendarStudent[] | CalendarStaff[],
    kind: "students" | "staff",
  ) => {
    const details = members.map((person) => {
      const input = { ...person, student_id: person.id };
      const context = { hasTutorLog, plannedStudentIds };
      const { plannedStatus } = kind === "students"
        ? deriveStudentAttendanceStatus(input, context)
        : deriveStaffAttendanceStatus(input, context);
      return { person, plannedStatus, actualAttended: person.actual_attended };
    });
    const count = attendance ? formatSessionAttendanceCount(details, hasTutorLog) : members.length;
    return (
      <section className="space-y-1.5">
        <h4 className="text-xs font-medium text-muted-foreground">
        {kind === "students" ? "Students" : "Staff"} ({count})
        </h4>
        {members.length ? (
          details.map(({ person, plannedStatus, actualAttended }) => (
            <div
              key={person.id}
              className="flex flex-wrap items-center gap-1.5 text-xs"
            >
              {attendance ? (
                <AttendancePersonRow
                  href={`/${kind}/${person.id}`}
                  name={`${person.first_name} ${person.last_name}`}
                  plannedStatus={plannedStatus}
                  actualAttended={hasTutorLog ? actualAttended : null}
                />
              ) : (
                <Link
                  href={`/${kind}/${person.id}`}
                  className="text-xs hover:underline focus-visible:underline"
                >
                  {person.first_name} {person.last_name}
                </Link>
              )}
              {!attendance &&
              person.enrolled_at &&
              new Date(person.enrolled_at).getTime() > Date.now() ? (
                <Badge variant="secondary" className="text-[10px]">
                  Future enrollment
                </Badge>
              ) : null}
            </div>
          ))
      ) : (
        <p className="text-xs text-muted-foreground">None</p>
        )}
      </section>
    );
  };
  const dragProps = referenceDrag ? entityReferenceDragProps(referenceDrag) : undefined;
  return (
    <Popover open={open} onOpenChange={updateOpen}>
      <PopoverAnchor asChild>
        <div
          ref={triggerRef}
          role="button"
          tabIndex={0}
          aria-label={`${title} details`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? contentId : undefined}
          aria-describedby={instructionsId}
          draggable={dragProps?.draggable}
          onDragStart={dragProps ? (event) => {
            dragProps.onDragStart(event);
            if (event.target === event.currentTarget) {
              cancel();
              updateOpen(false);
            }
          } : undefined}
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              (event.key === "ArrowDown" || event.key === "Enter")
            ) {
              event.preventDefault();
              event.stopPropagation();
              cancel();
              updateOpen(true);
              requestAnimationFrame(() =>
                contentRef.current
                  ?.querySelector<HTMLAnchorElement>("a")
                  ?.focus(),
              );
            }
          }}
          onContextMenu={(event) => {
            if (event.defaultPrevented || event.shiftKey) return;
            event.preventDefault();
            cancel();
            updateOpen(true);
          }}
          onMouseEnter={() => {
            triggerHovered.current = true;
            show();
          }}
          onMouseLeave={() => {
            triggerHovered.current = false;
            hide();
          }}
          onPointerDown={(event) => {
            if (!dragProps || event.button !== 0) return;
            cancel();
            updateOpen(false);
          }}
          onFocus={(event) => {
            if (dragProps && !event.target.matches(":focus-visible")) return;
            cancel();
            updateOpen(true);
          }}
          onBlur={blur}
          className="h-full min-h-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {children}
          <span id={instructionsId} className="sr-only">
            Press Enter or Arrow Down to interact with details.
          </span>
        </div>
      </PopoverAnchor>
      <PopoverContent
        id={contentId}
        ref={contentRef}
        onEscapeKeyDown={() => {
          cancel();
          contentHovered.current = false;
          triggerRef.current?.focus();
          updateOpen(false);
        }}
        side={side}
        collisionPadding={detailsCollisionPadding}
        aria-label={`${title} details`}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onMouseEnter={() => {
          contentHovered.current = true;
          cancel();
        }}
        onMouseLeave={() => {
          contentHovered.current = false;
          hide();
        }}
        onFocus={cancel}
        onBlur={blur}
        onClick={(event) => event.stopPropagation()}
        className="z-[100] max-h-[min(70dvh,480px,var(--radix-popover-content-available-height))] w-80 max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain border bg-popover p-4 text-popover-foreground shadow-lg"
      >
        {attendance && openEntity?.href.startsWith("/sessions/") ? <EntityReferencePreview type="session" id={openEntity.href.split("/")[2].split("?")[0]} fallbackTitle={title} autoFocusSearch embedded /> : <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-sm font-semibold">{title}</h3>
              {status ? (
                <Badge className={`shrink-0 border-transparent text-[10px] ${statusToneClass(status)}`}>
                  {label(status)}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {subject ? (
                <Badge
                  variant="secondary"
                  style={subjectColor.style}
                  className={cn(
                    "text-[10px]",
                    subject.color
                      ? subjectColor.textColorClass
                      : "text-foreground",
                  )}
                >
                  {subject.long_name || subject.short_name || subject.name}
                </Badge>
              ) : null}
              {sessionType ? (
                <Badge variant="outline" className="text-[10px]">
                  {formatSessionType(sessionType)}
                </Badge>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              {subtitle}
            </div>
          </div>
          {students || attendance ? people(students ?? [], "students") : null}
          {people(staff, "staff")}
          {openEntity ? (
            <Button asChild size="sm" variant="outline" className="h-7 text-xs">
              <Link href={openEntity.href}>{openEntity.label}</Link>
            </Button>
          ) : null}
        </div>}
      </PopoverContent>
    </Popover>
  );
}
