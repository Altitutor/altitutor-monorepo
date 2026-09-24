'use client';

import { useState } from 'react';
import type { JSONContent } from '@tiptap/core';
import dynamic from 'next/dynamic';
import type { ActivityEntityReference, ActivityEventDisplay } from '../types';
import { ActivityTimelineMarker } from './ActivityTimelineMarker';
import { ActivityPerformerAvatar } from './ActivityPerformerAvatar';
import { FormattedActivityMessage } from './FormattedActivityMessage';
import { cn } from '@/shared/utils';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { ChevronDown, ChevronRight, Edit, MoreVertical, Trash2 } from 'lucide-react';
import { NoteContentDisplay } from '@/shared/components/NoteContentDisplay';
import { isTiptapContentEmpty, toEditorContent } from '@/shared/utils/plainTextToTiptapJson';
import {
  useEntityModals,
  type EntityModalType,
} from '@/shared/contexts/EntityModalContext';

const NotesEditorWithMentions = dynamic(
  () => import('@/shared/components/NotesEditorWithMentions').then((module) => module.NotesEditorWithMentions),
  { ssr: false }
);

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
  onUpdateNote?: (noteId: string, note: JSONContent) => Promise<void>;
  onDeleteNote?: (noteId: string) => Promise<void>;
  isUpdatingNote?: boolean;
  isDeletingNote?: boolean;
}

export function ActivityItem({
  activity,
  className,
  isNested = false,
  onOpenFormResponse,
  onUpdateNote,
  onDeleteNote,
  isUpdatingNote = false,
  isDeletingNote = false,
}: ActivityItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [editingNoteContent, setEditingNoteContent] = useState<JSONContent | null>(null);
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

  const beginEditingNote = () => {
    setEditingNoteContent(toEditorContent(activity.noteContent));
    setIsEditingNote(true);
  };

  const cancelEditingNote = () => {
    setEditingNoteContent(null);
    setIsEditingNote(false);
  };

  const saveNote = async () => {
    if (!activity.entityId || !editingNoteContent || isTiptapContentEmpty(editingNoteContent)) return;
    try {
      await onUpdateNote?.(activity.entityId, editingNoteContent);
      cancelEditingNote();
    } catch {
      // The feed reports the error and keeps the editor open for retrying.
    }
  };

  const deleteNote = async () => {
    if (!activity.entityId || !confirm('Are you sure you want to delete this note?')) return;
    try {
      await onDeleteNote?.(activity.entityId);
    } catch {
      // The feed reports the error and leaves the note in place.
    }
  };

  if (isNoteEvent) {
    return (
      <>
        <div className={cn('pb-4', className)}>
          <div className="group rounded-lg border bg-muted/20">
            <div className="flex items-center gap-2 px-3 py-2">
              <ActivityPerformerAvatar name={activity.performedBy.name} />
              <span className="flex min-w-0 text-sm">{performerName}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {activity.timestamp}
              </span>
              {!isEditingNote && onUpdateNote && onDeleteNote ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
                      aria-label="Note actions"
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={beginEditingNote}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => void deleteNote()}
                      disabled={isDeletingNote}
                      className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
            <div className="px-3 pb-3">
              {isEditingNote && editingNoteContent ? (
                <div className="space-y-3">
                  <NotesEditorWithMentions
                    content={editingNoteContent}
                    onChange={setEditingNoteContent}
                    placeholder="Edit note..."
                    disabled={isUpdatingNote}
                    minHeight="80px"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void saveNote()}
                      disabled={isUpdatingNote || isTiptapContentEmpty(editingNoteContent)}
                    >
                      {isUpdatingNote ? 'Saving…' : 'Save'}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={cancelEditingNote}
                      disabled={isUpdatingNote}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <NoteContentDisplay
                  content={activity.noteContent}
                  className="text-sm text-foreground"
                />
              )}
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
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
                isUpdatingNote={isUpdatingNote}
                isDeletingNote={isDeletingNote}
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
              onUpdateNote={onUpdateNote}
              onDeleteNote={onDeleteNote}
              isUpdatingNote={isUpdatingNote}
              isDeletingNote={isDeletingNote}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
