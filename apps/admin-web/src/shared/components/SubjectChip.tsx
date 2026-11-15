"use client";
import type { Tables } from "@altitutor/shared";
import { EntityActionChip } from "./EntityActionChip";
import { openEntityReference } from "@/shared/utils/entityReference";
import { getSubjectColorStyle } from "@/shared/utils";
export function SubjectChip({
  subject,
  label,
}: {
  label?: string;
  subject: Tables<"subjects">;
}) {
  const { style, textColorClass } = getSubjectColorStyle(subject);
  return (
    <EntityActionChip
      entityType="subject"
      entityId={subject.id}
      label={
        label ||
        subject.short_name ||
        subject.long_name ||
        subject.name ||
        "Subject"
      }
      className={subject.color ? textColorClass : undefined}
      style={style}
      onClick={() => openEntityReference("subject", subject.id)}
    />
  );
}
