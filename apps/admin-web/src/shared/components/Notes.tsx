'use client';

import { useState, useCallback } from 'react';
import { Button } from '@altitutor/ui';
import { Card, CardContent } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { format } from 'date-fns';
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useCurrentStaff } from '@/shared/hooks';
import { useCreateNote, useUpdateNote, useDeleteNote } from '@/shared/hooks/useNotes';
import { NotesEditorWithMentions } from '@/shared/components/NotesEditorWithMentions';
import { NoteComposerWithTemplate } from '@/shared/components/NoteComposerWithTemplate';
import { NoteContentDisplay } from '@/shared/components/NoteContentDisplay';
import {
  isTiptapContentEmpty,
  toEditorContent,
} from '@/shared/utils/plainTextToTiptapJson';
import type { Tables } from '@altitutor/shared';
import type { JSONContent } from '@tiptap/core';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

type NotesProps = {
  targetType: 'students' | 'classes' | 'staff' | 'sessions';
  targetId: string;
  notes: NoteWithStaff[];
  onNoteAdded?: () => void;
  title?: string;
};

export function Notes({ targetType, targetId, notes, onNoteAdded, title }: NotesProps) {
  const [newNoteContent, setNewNoteContent] = useState<JSONContent>(EMPTY_DOC);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState<JSONContent>(EMPTY_DOC);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  const handleSubmit = useCallback(async () => {
    if (isTiptapContentEmpty(newNoteContent) || !currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType,
        targetId,
        note: newNoteContent,
        staffId: currentStaff.id,
      });
      setNewNoteContent(EMPTY_DOC);
      onNoteAdded?.();
    } catch {
      // Error handled silently - user can retry
    }
  }, [newNoteContent, currentStaff?.id, targetType, targetId, createNoteMutation, onNoteAdded]);

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
    [editingNoteContent, updateNoteMutation, onNoteAdded]
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

  const titleMap: Record<typeof targetType, string> = {
    students: 'Student',
    classes: 'Class',
    staff: 'Staff',
    sessions: 'Session',
  };
  const displayTitle = title || `${titleMap[targetType]} Notes`;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{displayTitle}</h3>

      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className="group">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {note.staff
                      ? `${note.staff.first_name?.[0] || ''}${note.staff.last_name?.[0] || ''}`.toUpperCase()
                      : '?'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-medium text-foreground">
                        {formatAuthorName(note.staff)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    {editingNoteId === note.id ? (
                      <div className="space-y-2">
                        <NotesEditorWithMentions
                          content={editingNoteContent}
                          onChange={setEditingNoteContent}
                          placeholder="Edit note..."
                          disabled={updateNoteMutation.isPending}
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
                            variant="default"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            disabled={updateNoteMutation.isPending}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm">
                        <NoteContentDisplay content={note.note} />
                      </div>
                    )}
                  </div>

                  {editingNoteId !== note.id && (
                    <div className="flex-shrink-0">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(note)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(note.id)}
                            className="!text-destructive focus:!text-destructive focus:bg-destructive/10 hover:!text-destructive hover:bg-destructive/10 dark:!text-destructive dark:focus:!text-destructive dark:hover:!text-destructive dark:focus:bg-destructive/10 dark:hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-2">
        <NoteComposerWithTemplate
          content={newNoteContent}
          onChange={setNewNoteContent}
          onSubmit={handleSubmit}
          isSubmitting={createNoteMutation.isPending}
          canPost={Boolean(currentStaff)}
        />
      </div>
    </div>
  );
}
