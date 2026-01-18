'use client';

import { useState } from 'react';
import type { ActivityEventDisplay } from '../types';
import { ActivityIcon } from './ActivityIcon';
import { FormattedActivityMessage } from './FormattedActivityMessage';
import { cn } from '@/shared/utils';
import { Card, CardContent, Button } from '@altitutor/ui';
import { ChevronLeft, ChevronDown } from 'lucide-react';

interface ActivityItemProps {
  activity: ActivityEventDisplay;
  showConnector?: boolean;
  className?: string;
  isNested?: boolean; // For nested events when expanded
}

export function ActivityItem({ activity, showConnector = true, className, isNested: _isNested }: ActivityItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Check if this event can be expanded (has originalEvents)
  const canExpand = (activity.isGrouped || activity.isCoalesced) && 
                    activity.originalEvents && 
                    activity.originalEvents.length > 0;
  
  // Check if this is a note event with content
  const isNoteEvent = activity.icon === 'note' && activity.noteContent;
  
  return (
    <>
      <div className={cn('flex gap-3 relative', className)}>
        {/* Icon with connector line */}
        <div className="flex flex-col items-center">
          <ActivityIcon icon={activity.icon} color={activity.iconColor} />
          {showConnector && (
            <div className="w-0.5 h-full bg-border mt-2 min-h-[24px]" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 pb-6">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              {isNoteEvent ? (
                // Special rendering for notes to preserve line breaks
                <div className="text-sm text-foreground">
                  <span className="font-medium">{activity.performedBy.name}</span>
                  {' '}
                  <span className="text-muted-foreground">added a note:</span>
                  <Card className="mt-2">
                    <CardContent className="p-4">
                      <div className="text-muted-foreground whitespace-pre-wrap break-words">
                        {activity.noteContent}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                // Standard rendering for other events
                <div className="text-sm text-foreground">
                  {activity.isGrouped ? (
                    // For grouped activities, message already includes performer name
                    <FormattedActivityMessage activity={activity} />
                  ) : (
                    // For regular activities, show performer name separately
                    <>
                      <span className="font-medium">{activity.performedBy.name}</span>
                      {' '}
                      <FormattedActivityMessage activity={activity} />
                    </>
                  )}
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {activity.timestamp}
              </div>
            </div>
            
            {/* Expand/Collapse button */}
            {canExpand && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 mt-0.5"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronLeft className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Expanded original events */}
      {isExpanded && canExpand && activity.originalEvents && (
        <div className="ml-[15px] border-l-2 border-border pl-4 mt-2 space-y-0">
          {activity.originalEvents.map((originalEvent, index) => (
            <ActivityItem
              key={originalEvent.id}
              activity={originalEvent}
              showConnector={index < activity.originalEvents!.length - 1}
              isNested={true}
            />
          ))}
        </div>
      )}
    </>
  );
}

