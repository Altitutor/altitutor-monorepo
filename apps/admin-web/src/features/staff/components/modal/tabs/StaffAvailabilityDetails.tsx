"use client";

import type { Tables, TablesUpdate } from "@altitutor/shared";
import {
  AvailabilityFields,
} from "@/shared/components/AvailabilityFields";

export function StaffAvailabilityDetails({
  staff,
  draft,
  onChange,
}: {
  staff: Tables<"staff">;
  draft: TablesUpdate<"staff"> | null;
  onChange: (patch: TablesUpdate<"staff">) => void;
}) {
  const isEditMode = draft !== null;
  const availability = { ...staff, ...draft };

  return (
    <section
      className="space-y-4 border-t pt-4"
      aria-label="Staff availability"
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="text-lg font-semibold">Availability</h3>
        </div>
        <AvailabilityFields
          isEditing={isEditMode}
          getValue={(key) =>
            Boolean(availability[key])
          }
          onCheckedChange={(key, checked) => {
            onChange({ [key]: checked });
          }}
          showSessionTypes
        />
      </div>
    </section>
  );
}
