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
      className="space-y-4"
      aria-label="Staff availability"
    >
      <div>

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
