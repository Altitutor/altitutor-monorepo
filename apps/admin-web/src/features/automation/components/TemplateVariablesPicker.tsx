'use client';

import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Code, ChevronDown } from 'lucide-react';
import type { ActivityEntityType } from '../types';

interface TemplateVariablesPickerProps {
  entityType?: ActivityEntityType;
  hasClassId: boolean;
  hasSessionId: boolean;
  onInsert: (variable: string) => void;
}


interface VariableGroup {
  title: string;
  variables: Array<{ name: string; description: string; example?: string }>;
}

export function TemplateVariablesPicker({
  entityType,
  hasClassId,
  hasSessionId,
  onInsert,
}: TemplateVariablesPickerProps) {
  const variableGroups: VariableGroup[] = [];

  // Common variables (always available)
  variableGroups.push({
    title: 'Common',
    variables: [
      { name: 'sender_name', description: 'Staff member who performed the action' },
      { name: 'entity_type', description: 'Entity type (e.g., "classes", "sessions")' },
      { name: 'entity_id', description: 'Entity ID' },
    ],
  });

  // Class variables
  if (hasClassId) {
    variableGroups.push({
      title: 'Class',
      variables: [
        { name: 'class.subject.long_name', description: 'Subject name', example: 'SACE 12 Mathematics' },
        { name: 'class.day_of_week', description: 'Day of week', example: 'Mon' },
        { name: 'class.start_time', description: 'Start time', example: '2:00 PM' },
        { name: 'class.end_time', description: 'End time', example: '4:00 PM' },
        { name: 'class.room', description: 'Room number' },
        { name: 'class.level', description: 'Class level' },
        { name: 'classes.subject.long_name', description: 'Subject name (alternative)' },
        { name: 'classes.day_of_week', description: 'Day of week (alternative)' },
        { name: 'classes.start_time', description: 'Start time (alternative)' },
        { name: 'classes.end_time', description: 'End time (alternative)' },
        { name: 'classes.room', description: 'Room number (alternative)' },
        { name: 'classes.level', description: 'Class level (alternative)' },
      ],
    });
  }

  // Session variables
  if (hasSessionId) {
    variableGroups.push({
      title: 'Session',
      variables: [
        { name: 'session.type', description: 'Session type' },
        { name: 'session.subject.long_name', description: 'Subject name (from class)' },
        { name: 'session.start_at', description: 'Start datetime', example: '2:00 PM' },
        { name: 'session.end_at', description: 'End datetime', example: '4:00 PM' },
        { name: 'sessions.type', description: 'Session type (alternative)' },
        { name: 'sessions.subject.long_name', description: 'Subject name (alternative)' },
        { name: 'sessions.start_at', description: 'Start datetime (alternative)' },
        { name: 'sessions.end_at', description: 'End datetime (alternative)' },
      ],
    });
  }

  // Changed field variables (for UPDATE events)
  variableGroups.push({
    title: 'Changed Fields',
    variables: [
      { name: 'changed_field', description: 'Name of first changed field' },
      { name: 'changed_field_name', description: 'Name of first changed field (alternative)' },
      { name: 'old_value', description: 'Old value of first changed field' },
      { name: 'new_value', description: 'New value of first changed field' },
      { name: 'changed_field.{field_name}.name', description: 'Name of specific changed field' },
      { name: 'changed_field.{field_name}.old_value', description: 'Old value of specific changed field' },
      { name: 'changed_field.{field_name}.new_value', description: 'New value of specific changed field' },
    ],
  });

  // Entity-specific variables (if entityData is available)
  if (entityType === 'classes') {
    variableGroups.push({
      title: 'Entity (Class)',
      variables: [
        { name: 'entity.subject.long_name', description: 'Subject name' },
        { name: 'entity.day_of_week', description: 'Day of week' },
        { name: 'entity.start_time', description: 'Start time' },
        { name: 'entity.end_time', description: 'End time' },
        { name: 'entity.room', description: 'Room number' },
        { name: 'entity.level', description: 'Class level' },
      ],
    });
  }

  if (entityType === 'sessions') {
    variableGroups.push({
      title: 'Entity (Session)',
      variables: [
        { name: 'entity.type', description: 'Session type' },
        { name: 'entity.subject.long_name', description: 'Subject name' },
        { name: 'entity.start_at', description: 'Start datetime' },
        { name: 'entity.end_at', description: 'End datetime' },
      ],
    });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="gap-2">
          <Code className="h-4 w-4" />
          Variables
          <ChevronDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-4 border-b">
          <h4 className="font-semibold text-sm">Template Variables</h4>
          <p className="text-xs text-muted-foreground mt-1">
            Click a variable to insert it into your template
          </p>
        </div>
        <ScrollArea className="h-[400px]">
          <div className="p-4 space-y-4">
            {variableGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {group.title}
                </h5>
                <div className="space-y-1">
                  {group.variables.map((variable) => (
                    <button
                      key={variable.name}
                      type="button"
                      onClick={() => onInsert(`{${variable.name}}`)}
                      className="w-full text-left p-2 rounded-md hover:bg-muted transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <Badge variant="outline" className="font-mono text-xs mb-1">
                            {`{${variable.name}}`}
                          </Badge>
                          <p className="text-xs text-muted-foreground">{variable.description}</p>
                          {variable.example && (
                            <p className="text-xs text-muted-foreground mt-1 italic">
                              Example: {variable.example}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
