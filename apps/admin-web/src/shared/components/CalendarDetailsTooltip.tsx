"use client";

import type { ReactNode } from "react";
import {
  Badge,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@altitutor/ui";
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
}) {
  if (!enabled) return <>{children}</>;
  const people = (
    members: CalendarStudent[] | CalendarStaff[],
    kind: "students" | "staff",
  ) => (
    <section className="space-y-1.5">
      <h4 className="text-xs font-medium text-muted-foreground">
        {kind === "students" ? "Students" : "Staff"}
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
              className="flex flex-wrap items-center gap-1.5 text-sm"
            >
              <span>
                {person.first_name} {person.last_name}
              </span>
              {attendance ? (
                <>
                  <Badge variant="outline" className="text-[10px]">
                    Planned: {label(derived.plannedStatus)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Actual: {label(derived.actualStatus)}
                  </Badge>
                </>
              ) : null}
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
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            tabIndex={0}
            aria-label={`${title} details`}
            className="h-full min-h-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {children}
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="max-h-[min(70vh,480px)] w-80 max-w-[calc(100vw-24px)] overflow-y-auto border bg-popover p-4 text-popover-foreground shadow-lg"
        >
          <div className="space-y-3">
            <div className="space-y-1">
              <h3 className="text-sm font-semibold">{title}</h3>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {subtitle}
                {status ? (
                  <Badge variant="outline" className="text-[10px]">
                    {label(status)}
                  </Badge>
                ) : null}
              </div>
            </div>
            {students ? people(students, "students") : null}
            {people(staff, "staff")}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
