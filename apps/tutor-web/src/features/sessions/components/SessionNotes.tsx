'use client';

import { useState, useCallback } from 'react';
import { Button } from '@altitutor/ui';
import { RichTextEditor } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { format } from 'date-fns';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useCreateSessionNote, useUpdateNote, useDeleteNote } from '../hooks/useSessionNotes';
import {
  isTiptapContentEmpty,
  toEditorContent,
} from '@/shared/utils/plainTextToTiptapJson';
import {
  tutorBtnOutline,
  tutorBtnPrimary,
  tutorCardCn,
  tutorModalHairline,
} from '@/shared/lib/tutor-visual';
import { cn } from '@/shared/utils';
import type { Tables } from '@altitutor/shared';
import type { JSONContent } from '@altitutor/ui';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

type SessionNotesProps = {
  sessionId: string;
  notes: NoteWithStaff[];
  onNoteAdded?: () => void;
  /** Current staff ID for filtering notes and authorization - provided by parent */
  currentStaffId?: string | null;
};

function NoteAuthorAvatar({ staff }: { staff: Tables<'staff'> | null | undefined }) {
  const initials = staff
    ? `${staff.first_name?.[0] || ''}${staff.last_name?.[0] || ''}`.toUpperCase()
    : '?';

  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        'bg-muted/80 text-xs font-medium text-muted-foreground ring-1 ring-black/[0.06] dark:ring-white/10',
      )}
    >
      {initials}
    </div>
  );
}

export function SessionNotes({
  sessionId,
  notes,
  onNoteAdded,
  currentStaffId,
}: SessionNotesProps) {
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState<JSONContent>(EMPTY_DOC);
  const createNoteMutation = useCreateSessionNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  const handleSubmit = useCallback(async () => {
    if (isTiptapContentEmpty(newNoteContent) || !currentStaffId) return;

    try {
      await createNoteMutation.mutateAsync({
        sessionId,
        note: newNoteContent,
      });
      setNewNoteContent(EMPTY_DOC);
      onNoteAdded?.();
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaffId, sessionId, createNoteMutation, onNoteAdded]);

  const formatAuthorName = (staff: Tables<'staff'> | null | undefined) => {
    if (!staff) return 'Unknown';
    return `${staff.first_name} ${staff.last_name}`.trim() || 'Unknown';
  };

  const handleEdit = useCallback((note: NoteWithStaff) => {
    setEditingNoteId(note.id);
    setEditingNoteContent(toEditorContent(note.note));
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId(null);
    setEditingNoteContent(EMPTY_DOC);
  }, []);

  const handleSaveEdit = useCallback(
    async (noteId: string) => {
      if (isTiptapContentEmpty(editingNoteContent)) return;

      try {
        await updateNoteMutation.mutateAsync({
          noteId,
          note: editingNoteContent,
        });
        setEditingNoteId(null);
        setEditingNoteContent(EMPTY_DOC);
        onNoteAdded?.();
      } catch {
        // Error handled silently - user can retry
      }
    },
    [editingNoteContent, updateNoteMutation, onNoteAdded],
  );

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNoteMutation.mutateAsync(noteId);
      onNoteAdded?.();
    } catch {
      // Error handled silently - user can retry
    }
  };

  return (
    <div>
      <h3 className="mb-4 text-lg font-semibold">Session Notes</h3>

      {notes.length > 0 && (
        <div className="mb-4 space-y-3">
          {notes.map((note) => (
            <div key={note.id} className={tutorCardCn('group p-4')}>
              <div className="flex gap-3">
                <NoteAuthorAvatar staff={note.staff} />

                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {formatAuthorName(note.staff)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <RichTextEditor
                        content={editingNoteContent}
                        onChange={setEditingNoteContent}
                        placeholder="Edit note..."
                        editable={!updateNoteMutation.isPending}
                        minHeight="80px"
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleSaveEdit(note.id)}
                          disabled={
                            isTiptapContentEmpty(editingNoteContent) ||
                            updateNoteMutation.isPending
                          }
                          size="sm"
                          className={tutorBtnPrimary}
                        >
                          Save
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          disabled={updateNoteMutation.isPending}
                          size="sm"
                          variant="outline"
                          className={tutorBtnOutline}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-foreground">
                      <RichTextEditor
                        content={toEditorContent(note.note)}
                        onChange={() => {}}
                        editable={false}
                        minHeight="0px"
                      />
                    </div>
                  )}
                </div>

                {editingNoteId !== note.id && note.created_by === currentStaffId && (
                  <div className="shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(note)}>
                          <Edit className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(note.id)}
                          className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {notes.length > 0 && <div className={cn(tutorModalHairline, 'mb-4')} role="presentation" />}

      <div className={tutorCardCn('space-y-3 p-4')}>
        <RichTextEditor
          content={newNoteContent}
          onChange={setNewNoteContent}
          placeholder="Add a note..."
          editable={!createNoteMutation.isPending && !!currentStaffId}
          minHeight="80px"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {createNoteMutation.isPending ? 'Posting…' : ''}
          </span>
          <Button
            onClick={handleSubmit}
            disabled={
              isTiptapContentEmpty(newNoteContent) ||
              createNoteMutation.isPending ||
              !currentStaffId
            }
            size="sm"
            className={tutorBtnPrimary}
          >
            Post note
          </Button>
        </div>
      </div>
    </div>
  );
}
