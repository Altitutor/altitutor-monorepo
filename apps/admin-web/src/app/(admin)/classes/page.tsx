"use client";
import { AdminPageActions } from "@/shared/components/AdminPageActions";

import { Suspense, useState } from "react";
import {
  ClassesTable,
  ViewClassModal,
  AddClassModal,
} from "@/features/classes";
import { CalendarView } from "@/features/classes/components/CalendarView";
import { Checkbox } from "@altitutor/ui";
import { ClassesAddMenu } from "@/features/classes/components/ClassesAddMenu";
import { AddAdminShiftModal } from "@/features/admin-shifts";
import { useAdminPageViewParam } from "@/shared/hooks/useAdminPageViewParam";
import { useClassesWithDetails } from "@/features/classes/hooks/useClassesQuery";
import { useAdminShiftsWithDetails } from "@/features/admin-shifts/hooks/useAdminShiftsQuery";
import type { Tables } from "@altitutor/shared";
import { ViewAdminShiftModal } from "@/features/admin-shifts/components/modal";

export default function ClassesPage() {
  const [view, setView] = useAdminPageViewParam(
    ["table", "calendar"] as const,
    "table",
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddAdminShiftOpen, setIsAddAdminShiftOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedAdminShiftId, setSelectedAdminShiftId] = useState<
    string | null
  >(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isAdminShiftDetailModalOpen, setIsAdminShiftDetailModalOpen] =
    useState(false);

  const { data, refetch } = useClassesWithDetails();
  const { data: adminShiftsData, refetch: refetchAdminShifts } =
    useAdminShiftsWithDetails();

  const classes: Tables<"classes">[] =
    (data?.classes as Tables<"classes">[]) || [];
  const classSubjects: Record<
    string,
    Tables<"subjects">
  > = (data?.classSubjects as Record<string, Tables<"subjects">>) || {};
  const classStudents: Record<string, Tables<"students">[]> =
    (data?.classStudents as Record<string, Tables<"students">[]>) || {};
  const classStaff: Record<string, Tables<"staff">[]> =
    (data?.classStaff as Record<string, Tables<"staff">[]>) || {};

  const adminShifts: Tables<"admin_shifts">[] =
    (adminShiftsData?.adminShifts as Tables<"admin_shifts">[]) || [];
  const adminShiftStaff: Record<string, Tables<"staff">[]> =
    (adminShiftsData?.adminShiftStaff as Record<string, Tables<"staff">[]>) ||
    {};

  const handleClassClick = (cls: Tables<"classes">) => {
    setSelectedClassId(cls.id);
    setIsDetailModalOpen(true);
  };

  const handleAdminShiftClick = (shift: Tables<"admin_shifts">) => {
    setSelectedAdminShiftId(shift.id);
    setIsAdminShiftDetailModalOpen(true);
  };

  const handleClassUpdated = () => {
    refetch();
  };

  const handleAdminShiftUpdated = () => {
    refetchAdminShifts();
  };

  return (
    <div className="p-6 space-y-4">
      <AdminPageActions>
        <div className="flex items-center gap-4">
          <ClassesAddMenu
            onAddClass={() => setIsAddModalOpen(true)}
            onAddAdminShift={() => setIsAddAdminShiftOpen(true)}
          />
        </div>
      </AdminPageActions>

      <Suspense>
        <ClassesTable
          addModalState={[isAddModalOpen, setIsAddModalOpen]}
          viewMode={view}
          toolbarView={{
            value: view,
            options: [
              { value: "table", label: "Table" },
              { value: "calendar", label: "Calendar" },
            ],
            onChange: (next) => setView(next as "table" | "calendar"),
          }}
          calendarControls={({ filters, onChange }) => (
            <label className="flex items-center justify-between gap-4 py-1.5 text-sm text-muted-foreground">
              Show admin shifts
              <Checkbox
                checked={filters.show_admin_shifts?.includes(1) ?? false}
                onCheckedChange={(checked) => {
                  const next = { ...filters };
                  if (checked === true) next.show_admin_shifts = [1];
                  else delete next.show_admin_shifts;
                  onChange(next);
                }}
              />
            </label>
          )}
          renderCalendar={({ filters, search, visibleColumns }) => (
            <CalendarView
              classes={classes.filter((cls) => {
                const subjects = filters.subject ?? [],
                  students = filters.student ?? [],
                  staff = filters.staff ?? [];
                return (
                  (!subjects.length || subjects.includes(cls.subject_id)) &&
                  (!students.length ||
                    (classStudents[cls.id] ?? []).some((student) =>
                      students.includes(student.id),
                    )) &&
                  (!staff.length ||
                    (classStaff[cls.id] ?? []).some((member) =>
                      staff.includes(member.id),
                    ))
                );
              })}
              classSubjects={classSubjects}
              classStudents={classStudents}
              classStaff={classStaff}
              onClassClick={handleClassClick}
              showFilters={false}
              searchValue={search}
              selectedDays={(filters.day ?? []).map(Number)}
              visibleProperties={visibleColumns}
              adminShifts={adminShifts}
              adminShiftStaff={adminShiftStaff}
              onAdminShiftClick={handleAdminShiftClick}
              showAdminShifts={filters.show_admin_shifts?.includes(1) ?? false}
            />
          )}
        />
      </Suspense>

      <AddAdminShiftModal
        isOpen={isAddAdminShiftOpen}
        onClose={() => setIsAddAdminShiftOpen(false)}
        onAdminShiftAdded={() => refetchAdminShifts()}
      />

      {/* Add Class Modal */}
      <AddClassModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onClassAdded={() => {
          refetch();
        }}
      />

      {/* Class Detail Modal for Calendar View */}
      {selectedClassId && (
        <ViewClassModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedClassId(null);
          }}
          classId={selectedClassId}
          onClassUpdated={handleClassUpdated}
        />
      )}

      {/* Admin Shift Detail Modal for Calendar View */}
      {selectedAdminShiftId && (
        <ViewAdminShiftModal
          isOpen={isAdminShiftDetailModalOpen}
          onClose={() => {
            setIsAdminShiftDetailModalOpen(false);
            setSelectedAdminShiftId(null);
          }}
          adminShiftId={selectedAdminShiftId}
          onAdminShiftUpdated={handleAdminShiftUpdated}
        />
      )}
    </div>
  );
}
