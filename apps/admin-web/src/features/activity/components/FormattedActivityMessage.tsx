import type {
  ActivityEntityReference,
  ActivityEventDisplay,
  ChangedField,
} from '../types';
import { renderTextWithTagsAsPlainText } from '@/shared/utils/tagDisplay';

interface FormattedActivityMessageProps {
  activity: ActivityEventDisplay;
  onEntityClick?: (entity: ActivityEntityReference) => void;
}

function cleanValue(value: string | undefined): string {
  return renderTextWithTagsAsPlainText(value?.replace(/^["']|["']$/g, '') || '');
}

function renderFieldChange(field: ChangedField) {
  const cleanOldValue = cleanValue(field.oldValue);
  const cleanNewValue = cleanValue(field.newValue);

  if (cleanOldValue && cleanNewValue) {
    return (
      <>
        <span className="text-muted-foreground">{field.fieldLabel}</span> from{' '}
        <span className="text-primary">{cleanOldValue}</span> to{' '}
        <span className="text-primary">{cleanNewValue}</span>
      </>
    );
  }

  if (cleanNewValue) {
    return (
      <>
        <span className="text-muted-foreground">{field.fieldLabel}</span> to{' '}
        <span className="text-primary">{cleanNewValue}</span>
      </>
    );
  }

  return <span className="text-muted-foreground">{field.fieldLabel}</span>;
}

function formatInlineMessage(messageWithoutName: string): JSX.Element {
  const fromToPattern = /^(\w+)\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+?)$/i;
  const fromToMatch = messageWithoutName.match(fromToPattern);
  if (fromToMatch) {
    const [, actionVerb, field, oldVal, newVal] = fromToMatch;
    return (
      <>
        {actionVerb}{' '}
        <span className="text-muted-foreground">{field.replace(/^["']|["']$/g, '')}</span> from{' '}
        <span className="text-primary">{cleanValue(oldVal)}</span> to{' '}
        <span className="text-primary">{cleanValue(newVal)}</span>
      </>
    );
  }

  const toPattern = /^(\w+)\s+(.+?)\s+to\s+(.+?)$/i;
  const toMatch = messageWithoutName.match(toPattern);
  if (toMatch) {
    const [, actionVerb, field, value] = toMatch;
    return (
      <>
        {actionVerb}{' '}
        <span className="text-muted-foreground">{field.replace(/^["']|["']$/g, '')}</span> to{' '}
        <span className="text-primary">{cleanValue(value)}</span>
      </>
    );
  }

  return <>{renderTextWithTagsAsPlainText(messageWithoutName)}</>;
}

/**
 * Formats activity messages inline for the Linear-style feed.
 */
export function FormattedActivityMessage({
  activity,
  onEntityClick,
}: FormattedActivityMessageProps) {
  const message = activity.message;
  const performedByName = activity.performedBy.name;

  if (activity.isGrouped || activity.isCoalesced) {
    return <>{renderTextWithTagsAsPlainText(message)}</>;
  }

  if (activity.messageParts?.length && !activity.changedFields?.length) {
    return (
      <>
        {activity.messageParts.map((part, index) => part.kind === 'entity' ? (
          <button
            key={`${part.entity.entityType}-${part.entity.entityId}-${index}`}
            type="button"
            className="font-medium underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onEntityClick?.(part.entity)}
            aria-label={`Open ${part.entity.entityType} ${part.text}`}
          >
            {part.text}
          </button>
        ) : (
          <span key={`text-${index}`}>{part.text}</span>
        ))}
      </>
    );
  }

  const messageWithoutName = message.replace(performedByName, '').trim();
  const actionMatch = messageWithoutName.match(/^(\w+)\s/);
  const action = actionMatch ? actionMatch[1] : 'updated';

  if (activity.changedFields && activity.changedFields.length > 0) {
    if (activity.changedFields.length === 1) {
      return (
        <>
          {action} {renderFieldChange(activity.changedFields[0]!)}
        </>
      );
    }

    return (
      <>
        {action}{' '}
        {activity.changedFields.map((field, index) => (
          <span key={field.fieldName}>
            {index > 0 ? ', ' : null}
            {renderFieldChange(field)}
          </span>
        ))}
      </>
    );
  }

  const fieldName =
    activity.changedFieldLabel ||
    (activity.changedFieldName ? activity.changedFieldName.replace(/_/g, ' ') : '');
  const cleanOldValue = cleanValue(activity.oldValue);
  const cleanNewValue = cleanValue(activity.newValue);

  if (fieldName && (cleanOldValue || cleanNewValue)) {
    return (
      <>
        {action} {renderFieldChange({
          fieldName: activity.changedFieldName ?? fieldName,
          fieldLabel: fieldName,
          oldValue: activity.oldValue,
          newValue: activity.newValue,
        })}
      </>
    );
  }

  if (fieldName) {
    return (
      <>
        {action} <span className="text-muted-foreground">{fieldName}</span>
      </>
    );
  }

  return formatInlineMessage(messageWithoutName);
}
