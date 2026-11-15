"use client";

import { EntitySidebarSection } from '@/shared/components/EntitySidebarCard';
import type { Tables, TablesUpdate } from "@altitutor/shared";
import { Input } from "@altitutor/ui";
import {
  AvailabilityFields,
  type AvailabilitySlotKey,
} from "@/shared/components/AvailabilityFields";
import {
  PropertyForm,
  PropertyFormRow,
} from "@/shared/components/PropertyForm";

export function StudentEducationDetails({
  student,
  draft,
  onChange,
}: {
  student: Tables<"students">;
  draft: TablesUpdate<"students"> | null;
  onChange: (patch: TablesUpdate<"students">) => void;
}) {
  const isEditMode = draft !== null;
  const inPersonDetails = { ...student, ...draft };

  return (
    <section
      className="space-y-4"
      aria-label="Education and availability"
    >
      <EntitySidebarSection title="Education">
        <PropertyForm>
          <PropertyFormRow
            label="School"
            htmlFor={isEditMode ? "in-person-school" : undefined}
          >
            {isEditMode ? (
              <Input
                id="in-person-school"
                value={inPersonDetails.school ?? ""}
                onChange={(event) =>
                  onChange({
                    school: event.target.value || null,
                  })
                }
              />
            ) : (
              <div>{student.school || "—"}</div>
            )}
          </PropertyFormRow>
          <PropertyFormRow
            label="Curriculum"
            htmlFor={isEditMode ? "in-person-curriculum" : undefined}
          >
            {isEditMode ? (
              <select
                id="in-person-curriculum"
                className="h-10 rounded-md border border-input bg-background px-3"
                value={inPersonDetails.curriculum ?? ""}
                onChange={(event) =>
                  onChange({
                    curriculum: (event.target.value ||
                      null) as Tables<"students">["curriculum"],
                  })
                }
              >
                <option value="">Not set</option>
                {["SACE", "IB", "PRESACE", "PRIMARY", "MEDICINE"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ),
                )}
              </select>
            ) : (
              <div>{student.curriculum || "—"}</div>
            )}
          </PropertyFormRow>
          <PropertyFormRow
            label="Year level"
            htmlFor={isEditMode ? "in-person-year-level" : undefined}
          >
            {isEditMode ? (
              <Input
                id="in-person-year-level"
                form="student-edit-form"
                type="number"
                min={1}
                max={13}
                value={inPersonDetails.year_level ?? ""}
                onChange={(event) =>
                  onChange({
                    year_level: event.target.value
                      ? Number(event.target.value)
                      : null,
                  })
                }
              />
            ) : (
              <div>
                {student.year_level ? `Year ${student.year_level}` : "—"}
              </div>
            )}
          </PropertyFormRow>
        </PropertyForm>
      </EntitySidebarSection>
      <EntitySidebarSection title="Availability">
        <AvailabilityFields
          isEditing={isEditMode}
          getValue={(key) =>
            Boolean(inPersonDetails[key as keyof Tables<"students">])
          }
          onCheckedChange={(key: AvailabilitySlotKey, checked) => {
            onChange({ [key]: checked });
          }}
        />
      </EntitySidebarSection>
    </section>
  );
}
