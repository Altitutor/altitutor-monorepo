'use client';

import { useState } from 'react';
import type { ActivityEntityReference, ActivityEventDisplay } from '../types';
import { ActivityTimelineMarker } from './ActivityTimelineMarker';
import { ActivityPerformerAvatar } from './ActivityPerformerAvatar';
import { FormattedActivityMessage } from './FormattedActivityMessage';
import { cn } from '@/shared/utils';
import { Button } from '@altitutor/ui';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { NoteContentDisplay } from '@/shared/components/NoteContentDisplay';
import {
  useEntityModals,
  type EntityModalType,
} from '@/shared/contexts/EntityModalContext';

const ENTITY_MODAL_TYPES: Partial<Record<ActivityEntityReference['entityType'], EntityModalType>> = {
  student: 'student',
  parent: 'parent',
  staff: 'staff',
  class: 'class',
  admin_shift: 'admin-shift',
  session: 'session',
  invoice: 'invoice',
  task: 'task',
  issue: 'issue',
  project: 'project',
  note: 'note',
};

interface ActivityItemProps {
  activity: ActivityEventDisplay;
  className?: string;
  isNested?: boolean;
  onOpenFormResponse?: (responseId: string) => void;
}

export function ActivityItem({
  activity,
  className,
  isNested = false,
  onOpenFormResponse,
}: ActivityItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { openEntity } = useEntityModals();

  const openLinkedEntity = (entity: ActivityEntityReference) => {
    const modalType = ENTITY_MODAL_TYPES[entity.entityType];
    if (modalType) openEntity(modalType, entity.entityId);
  };

  const performerName = activity.performedBy.id ? (
    <button
      type="button"
      className="truncate font-medium underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={() => openEntity('staff', activity.performedBy.id)}
      aria-label={`Open staff ${activity.performedBy.name}`}
    >
      {activity.performedBy.name}
    </button>
  ) : (
    <span className="truncate font-medium">{activity.performedBy.name}</span>
  );

  const canExpand =
    (activity.isGrouped || activity.isCoalesced) &&
    activity.originalEvents &&
    activity.originalEvents.length > 0;

  const isNoteEvent = activity.icon === 'note' && activity.noteContent;

  if (isNoteEvent) {
    return (
      <>
        <div className={cn('pb-4', className)}>
          <div className="rounded-lg border bg-muted/20">
            <div className="flex items-center gap-2 px-3 py-2">
              <ActivityPerformerAvatar name={activity.performedBy.name} />
              <span className="flex min-w-0 text-sm">{performerName}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {activity.timestamp}
              </span>
            </div>
            <div className="px-3 pb-3">
              <NoteContentDisplay
                content={activity.noteContent}
                className="text-sm text-foreground"
              />
            </div>
          </div>
        </div>

        {isExpanded && canExpand && activity.originalEvents ? (
          <div className="space-y-0">
            {activity.originalEvents.map((originalEvent) => (
              <ActivityItem
                key={originalEvent.id}
                activity={originalEvent}
                isNested
                onOpenFormResponse={onOpenFormResponse}
              />
            ))}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <>
      <div className={cn('relative flex gap-3', isNested ? 'pl-0' : '', className)}>
        <div className="relative flex w-5 shrink-0 flex-col items-center">
          <div className="relative z-[1] bg-background py-1">
            <ActivityTimelineMarker activity={activity} />
          </div>
        </div>

        <div className="min-w-0 flex-1 pb-4 pt-0.5">
          <div className="flex items-start gap-1.5">
            <div className="min-w-0 flex-1 text-sm leading-6 text-foreground">
              {activity.isGrouped || activity.isCoalesced ? (
                <>
                  <FormattedActivityMessage
                    activity={activity}
                    onEntityClick={openLinkedEntity}
                  />
                  <span className="text-muted-foreground"> • {activity.timestamp}</span>
                </>
              ) : (
                <>
                  {performerName}{' '}
                  <FormattedActivityMessage
                    activity={activity}
                    onEntityClick={openLinkedEntity}
                  />
                  <span className="text-muted-foreground"> • {activity.timestamp}</span>
                </>
              )}

              {activity.entityType === 'form_responses' && onOpenFormResponse ? (
                <div>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                    onClick={() => onOpenFormResponse(activity.entityId ?? '')}
                  >
                    Open / edit response
                  </Button>
                </div>
              ) : null}
            </div>

            {canExpand ? (
              <Button
                variant="ghost"
                size="icon"
                className="mt-0.5 h-6 w-6 shrink-0"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {isExpanded && canExpand && activity.originalEvents ? (
        <div className="space-y-0">
          {activity.originalEvents.map((originalEvent) => (
            <ActivityItem
              key={originalEvent.id}
              activity={originalEvent}
              isNested
              onOpenFormResponse={onOpenFormResponse}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
