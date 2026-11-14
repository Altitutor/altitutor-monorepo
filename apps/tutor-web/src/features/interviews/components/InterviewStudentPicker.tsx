"use client";

import { EntityChip, SearchableSelect } from "@altitutor/ui";
import type { InterviewStudent } from "@altitutor/shared";

export function InterviewStudentPicker({
  students,
  selectedIds,
  onChange,
  maxStudents,
}: {
  students: InterviewStudent[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  maxStudents?: number;
}) {
  const full = maxStudents !== undefined && selectedIds.length >= maxStudents;
  return (
    <div className="space-y-4">
      <SearchableSelect
        items={students.filter((student) => !selectedIds.includes(student.id))}
        value={null}
        onValueChange={(student) => {
          if (student && !full && !selectedIds.includes(student.id))
            onChange([...selectedIds, student.id]);
        }}
        getItemId={(student) => student.id}
        getItemLabel={(student) => student.name}
        ariaLabel="Add student"
        placeholder={full ? "Round is full" : "Add student"}
        searchPlaceholder="Search Medicine interview students…"
        emptyMessage="No eligible students to add."
        disabled={full}
        fullWidth
      />
      <div className="flex flex-wrap gap-2" aria-label="Selected students">
        {selectedIds.map((id) => {
          const student = students.find((item) => item.id === id);
          return (
            <EntityChip
              key={id}
              entityType="student"
              label={`${student?.name ?? "Student"} ×`}
              aria-label={`Remove ${student?.name ?? "student"}`}
              title={`Remove ${student?.name ?? "student"}`}
              onClick={() =>
                onChange(selectedIds.filter((selected) => selected !== id))
              }
            />
          );
        })}
        {!selectedIds.length ? (
          <p className="text-sm text-muted-foreground">No students selected.</p>
        ) : null}
      </div>
    </div>
  );
}
