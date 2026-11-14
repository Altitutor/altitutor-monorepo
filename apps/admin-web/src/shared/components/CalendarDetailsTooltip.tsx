"use client";

import { useEffect, useRef, useState, useId, type ReactNode } from "react";
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
} from "@altitutor/ui";
import { getSubjectColorStyle, formatSessionType, cn } from "@/shared/utils";
import { statusToneClass } from "@/shared/utils/statusTone";
import {
  deriveStudentAttendanceStatus,
  deriveStaffAttendanceStatus,
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
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  const instructionsId = useId();
  const triggerHovered = useRef(false);
  const contentHovered = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const cancel = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = () => {
    cancel();
    timer.current = setTimeout(() => setOpen(true), 250);
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
      setOpen(false);
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
  const people = (
    members: CalendarStudent[] | CalendarStaff[],
    kind: "students" | "staff",
  ) => (
    <section className="space-y-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">
        {kind === "students" ? `Students (${members.length})` : "Staff"}
      </h4>
      {members.length ? (
        members.map((person) => {
          const input = { ...person, student_id: person.id };
          const context = {
            hasTutorLog,
            plannedStudentIds: new Set(
              students
                ?.filter((student) => student.sessions_students_id)
                .map((student) => student.id),
            ),
          };
          const derived =
            kind === "students"
              ? deriveStudentAttendanceStatus(input, context)
              : deriveStaffAttendanceStatus(input, context);
          return (
            <div
              key={person.id}
              className="flex flex-wrap items-center gap-1.5 text-xs"
            >
              {attendance ? (
                <AttendancePersonRow
                  href={`/${kind}/${person.id}`}
                  name={`${person.first_name} ${person.last_name}`}
                  plannedStatus={derived.plannedStatus}
                  actualAttended={person.actual_attended}
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
          );
        })
      ) : (
        <p className="text-xs text-muted-foreground">None</p>
      )}
    </section>
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
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
          onKeyDown={(event) => {
            if (
              event.target === event.currentTarget &&
              (event.key === "ArrowDown" || event.key === "Enter")
            ) {
              event.preventDefault();
              event.stopPropagation();
              cancel();
              setOpen(true);
              requestAnimationFrame(() =>
                contentRef.current
                  ?.querySelector<HTMLAnchorElement>("a")
                  ?.focus(),
              );
            }
          }}
          onMouseEnter={() => {
            triggerHovered.current = true;
            show();
          }}
          onMouseLeave={() => {
            triggerHovered.current = false;
            hide();
          }}
          onFocus={() => {
            cancel();
            setOpen(true);
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
          setOpen(false);
        }}
        side="right"
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
        className="z-[100] max-h-[min(70vh,480px)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto border bg-popover p-4 text-popover-foreground shadow-lg"
      >
        {attendance && openEntity?.href.startsWith("/sessions/") ? <EntityReferencePreview type="session" id={openEntity.href.split("/")[2].split("?")[0]} fallbackTitle={title} studentCount={students?.length} embedded /> : <div className="space-y-3">
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
          {students ? people(students, "students") : null}
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
