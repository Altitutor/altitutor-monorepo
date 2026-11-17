import { EntityChipIcon, entityChipStyles } from "@altitutor/ui";
/** Visual reference inside an action; the enclosing action owns activation. */
export function ActionEntityChip({
  type,
  id,
  label,
}: {
  type: string;
  id: string;
  label: string;
}) {
  return (
    <span
      className={`${entityChipStyles} min-w-0 max-w-40`}
      data-action-context
      data-type={type}
      data-id={id}
    >
      <EntityChipIcon entityType={type} />
      <span className="truncate">{label}</span>
    </span>
  );
}
