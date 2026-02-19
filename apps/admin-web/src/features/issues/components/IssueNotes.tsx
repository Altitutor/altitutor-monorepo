'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@altitutor/ui';
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
import type { Tables } from '@altitutor/shared';

type NoteWithStaff = Tables<'notes'> & {
  staff?: Tables<'staff'> | null;
};

type IssueNotesProps = {
  issueId: string;
  notes: NoteWithStaff[];
  onNoteAdded?: () => void;
};

export function IssueNotes({ issueId, notes, onNoteAdded }: IssueNotesProps) {
  const [newNote, setNewNote] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { data: currentStaff } = useCurrentStaff();
  const createNoteMutation = useCreateNote();
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newNote]);

  const handleSubmit = async () => {
    if (!newNote.trim() || !currentStaff?.id) return;

    try {
      await createNoteMutation.mutateAsync({
        targetType: 'issues',
        targetId: issueId,
        note: newNote.trim(),
        staffId: currentStaff.id,
      });
      setNewNote('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      onNoteAdded?.();
    } catch (error) {
      console.error('Failed to create note:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // CMD+Enter (Mac) or Ctrl+Enter (Windows/Linux) to submit
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatAuthorName = (staff: Tables<'staff'> | null | undefined) => {
    if (!staff) return 'Unknown';
    return `${staff.first_name} ${staff.last_name}`.trim() || 'Unknown';
  };

  const handleEdit = (note: NoteWithStaff) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.note);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editingNoteText.trim()) return;

    try {
      await updateNoteMutation.mutateAsync({
        noteId,
        note: editingNoteText.trim(),
      });
      setEditingNoteId(null);
      setEditingNoteText('');
      onNoteAdded?.();
    } catch (error) {
      console.error('Failed to update note:', error);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteNoteMutation.mutateAsync(noteId);
      onNoteAdded?.();
    } catch (error) {
      console.error('Failed to delete note:', error);
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, noteId: string) => {
    // CMD+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit(noteId);
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Auto-resize edit textarea
  useEffect(() => {
    if (editTextareaRef.current && editingNoteId) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [editingNoteText, editingNoteId]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Progress</h3>

      {/* Notes List */}
      {notes.length > 0 && (
        <div className="space-y-3">
          {notes.map((note) => (
            <Card key={note.id} className="group border-none shadow-none bg-muted/30">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {note.staff
                      ? `${note.staff.first_name?.[0] || ''}${note.staff.last_name?.[0] || ''}`.toUpperCase()
                      : '?'}
                  </div>

                  {/* Note content */}
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
                        <Textarea
                          ref={editTextareaRef}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, note.id)}
                          className="min-h-[80px] resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSaveEdit(note.id)}
                            disabled={!editingNoteText.trim() || updateNoteMutation.isPending}
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
                      <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {note.note}
                      </div>
                    )}
                  </div>

                  {/* Actions menu */}
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

      {/* New Note Input */}
      <div className="relative rounded-lg border bg-card p-4">
        <Textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          className="min-h-[80px] resize-none border-0 bg-transparent pr-20 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          disabled={createNoteMutation.isPending || !currentStaff}
        />
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          {createNoteMutation.isPending && (
            <span className="text-xs text-muted-foreground">Posting...</span>
          )}
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!newNote.trim() || createNoteMutation.isPending || !currentStaff}
            size="sm"
            variant="default"
          >
            Post
          </Button>
        </div>
      </div>
    </div>
  );
}
