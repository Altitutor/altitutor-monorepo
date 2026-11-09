"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesUpdate } from "@altitutor/shared";
import { Button, Input, Separator, useToast } from "@altitutor/ui";
import { Pencil } from "lucide-react";
import {
  AvailabilityFields,
  type AvailabilitySlotKey,
} from "@/shared/components/AvailabilityFields";
import {
  PropertyForm,
  PropertyFormRow,
} from "@/shared/components/PropertyForm";
import { invalidateStudentDetail } from "@/shared/lib/query-invalidation";
import { studentsApi } from "@/features/students/api/students";

function educationFromStudent(
  student: Tables<"students">,
): TablesUpdate<"students"> {
  return {
    school: student.school,
    curriculum: student.curriculum,
    year_level: student.year_level,
    availability_monday: student.availability_monday,
    availability_tuesday: student.availability_tuesday,
    availability_wednesday: student.availability_wednesday,
    availability_thursday: student.availability_thursday,
    availability_friday: student.availability_friday,
    availability_saturday_am: student.availability_saturday_am,
    availability_saturday_pm: student.availability_saturday_pm,
    availability_sunday_am: student.availability_sunday_am,
    availability_sunday_pm: student.availability_sunday_pm,
  };
}

export function StudentEducationDetails({
  student,
  footerTarget,
}: {
  footerTarget: HTMLDivElement | null;
  student: Tables<"students">;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [inPersonDetails, setInPersonDetails] = useState(() =>
    educationFromStudent(student),
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const handleCancelEdit = () => {
    setIsEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await studentsApi.updateStudent(student.id, inPersonDetails);
      await invalidateStudentDetail(queryClient, student.id);
      setIsEditMode(false);
      toast({
        title: "Success",
        description: "In-person details updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update in-person details:", error);
      toast({
        title: "Update failed",
        description:
          "There was an error updating the in-person details. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="space-y-4 border-t pt-4"
      aria-label="Education and availability"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-base font-medium">Education</h3>
          {!isEditMode && (
            <Button
              variant="outline"
              size="sm"
              aria-label="Edit education"
              onClick={() => {
                setInPersonDetails(educationFromStudent(student));
                setIsEditMode(true);
              }}
              disabled={!!student.deleted_at}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
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
                  setInPersonDetails((current) => ({
                    ...current,
                    school: event.target.value || null,
                  }))
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
                  setInPersonDetails((current) => ({
                    ...current,
                    curriculum: (event.target.value ||
                      null) as Tables<"students">["curriculum"],
                  }))
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
                type="number"
                min={1}
                max={13}
                value={inPersonDetails.year_level ?? ""}
                onChange={(event) =>
                  setInPersonDetails((current) => ({
                    ...current,
                    year_level: event.target.value
                      ? Number(event.target.value)
                      : null,
                  }))
                }
              />
            ) : (
              <div>
                {student.year_level ? `Year ${student.year_level}` : "—"}
              </div>
            )}
          </PropertyFormRow>
        </PropertyForm>
      </div>
      <Separator />
      <div>
        <h3 className="text-lg font-semibold mb-4">Availability</h3>
        <AvailabilityFields
          isEditing={isEditMode}
          getValue={(key) =>
            Boolean(
              isEditMode
                ? inPersonDetails[key as keyof TablesUpdate<"students">]
                : student[key as keyof Tables<"students">],
            )
          }
          onCheckedChange={(key: AvailabilitySlotKey, checked) => {
            setInPersonDetails((current) => ({ ...current, [key]: checked }));
          }}
        />
      </div>
      {isEditMode &&
        footerTarget &&
        createPortal(
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              disabled={saving}
              onClick={handleCancelEdit}
            >
              Cancel
            </Button>
            <Button
              variant="default"
              disabled={saving}
              onClick={() => void handleSave()}
            >
              Save
            </Button>
          </div>,
          footerTarget,
        )}
    </section>
  );
}
