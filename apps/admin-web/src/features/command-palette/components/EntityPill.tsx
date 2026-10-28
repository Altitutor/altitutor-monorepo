import type { EntityTarget } from "../model";
import { paletteEntities } from "../model";

/** Identifies the record an action will affect, independently of the action label. */
export function EntityPill({ entity }: { entity: EntityTarget }) {
  const Icon = paletteEntities[entity.type].icon;
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
      data-entity-type={entity.type}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{entity.title}</span>
    </span>
  );
}
