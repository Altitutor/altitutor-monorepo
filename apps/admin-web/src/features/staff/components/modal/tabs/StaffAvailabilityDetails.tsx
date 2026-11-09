"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import type { Tables, TablesUpdate } from "@altitutor/shared";
import { Button, useToast } from "@altitutor/ui";
import { Pencil } from "lucide-react";
import {
  AvailabilityFields,
  type AvailabilitySlotKey,
} from "@/shared/components/AvailabilityFields";
import { invalidateStaffDetail } from "@/shared/lib/query-invalidation";
import { staffApi } from "@/features/staff/api/staff";

type StaffAvailabilityDraft = Pick<TablesUpdate<"staff">, AvailabilitySlotKey>;

function availabilityFromStaff(staff: Tables<"staff">): StaffAvailabilityDraft {
  return {
    availability_monday: Boolean(staff.availability_monday),
    availability_tuesday: Boolean(staff.availability_tuesday),
    availability_wednesday: Boolean(staff.availability_wednesday),
    availability_thursday: Boolean(staff.availability_thursday),
    availability_friday: Boolean(staff.availability_friday),
    availability_saturday_am: Boolean(staff.availability_saturday_am),
    availability_saturday_pm: Boolean(staff.availability_saturday_pm),
    availability_sunday_am: Boolean(staff.availability_sunday_am),
    availability_sunday_pm: Boolean(staff.availability_sunday_pm),
    drafting_availability: Boolean(staff.drafting_availability),
    trial_session_availability: Boolean(staff.trial_session_availability),
    subsidy_interview_availability: Boolean(
      staff.subsidy_interview_availability,
    ),
  };
}

export function StaffAvailabilityDetails({
  staff,
  footerTarget,
}: {
  footerTarget: HTMLDivElement | null;
  staff: Tables<"staff">;
}) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [availability, setAvailability] = useState(() =>
    availabilityFromStaff(staff),
  );
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const handleCancelEdit = () => {
    setAvailability(availabilityFromStaff(staff));
    setIsEditMode(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await staffApi.updateStaff(staff.id, availability);
      await invalidateStaffDetail(queryClient, staff.id);
      setIsEditMode(false);
      toast({
        title: "Success",
        description: "Availability updated successfully.",
      });
    } catch (error) {
      console.error("Failed to update availability:", error);
      toast({
        title: "Update failed",
        description:
          "There was an error updating availability. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="space-y-4 border-t pt-4"
      aria-label="Staff availability"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold">Availability</h3>
          {!isEditMode && (
            <Button
              variant="outline"
              size="sm"
              aria-label="Edit availability"
              onClick={() => {
                setAvailability(availabilityFromStaff(staff));
                setIsEditMode(true);
              }}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          )}
        </div>
        <AvailabilityFields
          isEditing={isEditMode}
          getValue={(key) =>
            Boolean(isEditMode ? availability[key] : staff[key])
          }
          onCheckedChange={(key, checked) => {
            setAvailability((current) => ({ ...current, [key]: checked }));
          }}
          showSessionTypes
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
