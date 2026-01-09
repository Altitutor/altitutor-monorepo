import type { ActivityEventDisplay } from '../types';

interface FormattedActivityMessageProps {
  activity: ActivityEventDisplay;
}

/**
 * Formats activity messages with styled field names and values
 * - Field names are displayed in a different color (muted-foreground)
 * - Field values are displayed in a different color (primary)
 * - Removes quotation marks from values
 * - Multiple field changes are displayed on separate lines
 */
export function FormattedActivityMessage({ activity }: FormattedActivityMessageProps) {
  const message = activity.message;
  const performedByName = activity.performedBy.name;
  
  // For grouped activities, just display the simple message directly
  if (activity.isGrouped) {
    return <>{message}</>;
  }
  
  // Remove the performer name from the message to format the rest
  const messageWithoutName = message.replace(performedByName, '').trim();
  
  // Extract the action verb from the message (updated, changed, moved, etc.)
  const actionMatch = messageWithoutName.match(/^(\w+)\s/);
  const action = actionMatch ? actionMatch[1] : 'updated';
  
  // Helper function to get entity name/type
  const getEntityDisplay = () => {
    return (
      activity.relatedEntities?.session?.name ||
      activity.relatedEntities?.class?.name ||
      activity.relatedEntities?.student?.name ||
      activity.relatedEntities?.staff?.name ||
      activity.relatedEntities?.task?.name ||
      activity.relatedEntities?.parent?.name ||
      (activity.relatedEntities?.session ? 'session' :
       activity.relatedEntities?.class ? 'class' :
       activity.relatedEntities?.student ? 'student' :
       activity.relatedEntities?.staff ? 'staff' :
       activity.relatedEntities?.task ? 'task' :
       activity.relatedEntities?.parent ? 'parent' :
       'item')
    );
  };
  
  // Handle multiple field changes
  if (activity.changedFields && activity.changedFields.length > 0) {
    const entityDisplay = getEntityDisplay();
    
    return (
      <>
        {/* First line: updated {entity} - inline with performer name */}
        <span>
          {action} {entityDisplay}
        </span>
        
        {/* Subsequent lines: field changes indented */}
        <div className="space-y-1 mt-1">
          {activity.changedFields.map((field) => {
          // Remove quotes from values
          const cleanOldValue = field.oldValue?.replace(/^["']|["']$/g, '') || '';
          const cleanNewValue = field.newValue?.replace(/^["']|["']$/g, '') || '';
          
          if (cleanOldValue && cleanNewValue) {
            // Field changed from old to new
            return (
              <div key={field.fieldName} className="ml-4">
                <span className="text-muted-foreground">{field.fieldLabel}</span> from <span className="text-primary">{cleanOldValue}</span> to <span className="text-primary">{cleanNewValue}</span>
              </div>
            );
          } else if (cleanNewValue && !cleanOldValue) {
            // Field assigned/set to new value
            return (
              <div key={field.fieldName} className="ml-4">
                <span className="text-muted-foreground">{field.fieldLabel}</span> to <span className="text-primary">{cleanNewValue}</span>
              </div>
            );
          } else {
            // Field updated but no values available
            return (
              <div key={field.fieldName} className="ml-4">
                <span className="text-muted-foreground">{field.fieldLabel}</span>
              </div>
            );
          }
          })}
        </div>
      </>
    );
  }
  
  // Fallback to single field handling (backward compatibility)
  const cleanOldValue = activity.oldValue?.replace(/^["']|["']$/g, '') || '';
  const cleanNewValue = activity.newValue?.replace(/^["']|["']$/g, '') || '';
  const fieldName = activity.changedFieldLabel || 
    (activity.changedFieldName 
      ? activity.changedFieldName.replace(/_/g, ' ')
      : '');
  
  const entityDisplay = getEntityDisplay();
  
  // If we have oldValue and newValue, format using stored values
  if (cleanOldValue && cleanNewValue && fieldName) {
    return (
      <>
        <span>
          {action} {entityDisplay}
        </span>
        <div className="ml-4 mt-1">
          <span className="text-muted-foreground">{fieldName}</span> from <span className="text-primary">{cleanOldValue}</span> to <span className="text-primary">{cleanNewValue}</span>
        </div>
      </>
    );
  }
  
  // If we only have newValue (assigned case)
  if (cleanNewValue && !cleanOldValue && fieldName) {
    return (
      <>
        <span>
          {action} {entityDisplay}
        </span>
        <div className="ml-4 mt-1">
          <span className="text-muted-foreground">{fieldName}</span> to <span className="text-primary">{cleanNewValue}</span>
        </div>
      </>
    );
  }
  
  // If we only have fieldName (simple update)
  if (fieldName && !cleanOldValue && !cleanNewValue) {
    return (
      <>
        <span>
          {action} {entityDisplay}
        </span>
        <div className="ml-4 mt-1">
          <span className="text-muted-foreground">{fieldName}</span>
        </div>
      </>
    );
  }
  
  // Fallback: parse the message string for common patterns
  const formatMessage = (msg: string): JSX.Element => {
    // Pattern: "{action} {field} from {old} to {new}"
    const fromToPattern = /^(\w+)\s+(.+?)\s+from\s+(.+?)\s+to\s+(.+?)$/i;
    const fromToMatch = msg.match(fromToPattern);
    if (fromToMatch) {
      const [, actionVerb, field, oldVal, newVal] = fromToMatch;
      return (
        <>
          {actionVerb} <span className="text-muted-foreground">{field.replace(/^["']|["']$/g, '')}</span> from <span className="text-primary">{oldVal.replace(/^["']|["']$/g, '')}</span> to <span className="text-primary">{newVal.replace(/^["']|["']$/g, '')}</span>
        </>
      );
    }
    
    // Pattern: "{action} {field} to {value}"
    const toPattern = /^(\w+)\s+(.+?)\s+to\s+(.+?)$/i;
    const toMatch = msg.match(toPattern);
    if (toMatch) {
      const [, actionVerb, field, value] = toMatch;
      return (
        <>
          {actionVerb} <span className="text-muted-foreground">{field.replace(/^["']|["']$/g, '')}</span> to <span className="text-primary">{value.replace(/^["']|["']$/g, '')}</span>
        </>
      );
    }
    
    // Pattern: "{action} {field}"
    const simplePattern = /^(\w+)\s+(.+?)$/i;
    const simpleMatch = msg.match(simplePattern);
    if (simpleMatch) {
      const [, actionVerb, field] = simpleMatch;
      // Only style if it looks like a field name (not a full sentence)
      if (field.length < 50 && !field.includes('.')) {
        return (
          <>
            {actionVerb} <span className="text-muted-foreground">{field.replace(/^["']|["']$/g, '')}</span>
          </>
        );
      }
    }
    
    // Fallback: return message as-is
    return <>{msg}</>;
  };
  
  return formatMessage(messageWithoutName);
}

