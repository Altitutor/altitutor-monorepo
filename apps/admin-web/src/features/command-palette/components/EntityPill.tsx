import type { RecordTarget } from "../model";
import { EntityChipIcon, entityChipStyles } from "@altitutor/ui";

/** Identifies the record an action will affect, independently of the action label. */
export function EntityPill({ entity }: { entity: RecordTarget }) {
  return (
    <span
      className={entityChipStyles}
      data-entity-type={entity.type}
      data-mention="true"
      data-type={entity.type}
      data-id={entity.id}
      data-label={entity.title}
    >
      <EntityChipIcon entityType={entity.type} />
      <span className="truncate">{entity.title}</span>
    </span>
  );
}
