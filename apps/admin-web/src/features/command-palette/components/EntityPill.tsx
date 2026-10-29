import type { EntityTarget } from "../model";
import { EntityChipIcon, entityChipStyles } from "@altitutor/ui";

/** Identifies the record an action will affect, independently of the action label. */
export function EntityPill({ entity }: { entity: EntityTarget }) {
  return (
    <span
      className={entityChipStyles}
      data-entity-type={entity.type}
    >
      <EntityChipIcon entityType={entity.type} />
      <span className="truncate">{entity.title}</span>
    </span>
  );
}
