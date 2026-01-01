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
import { MoreVertical, Edit, Trash2 } from 'lucide-react';

type Step8NotesProps = {
  notes: string[];
  onUpdate: (notes: string[]) => void;
};

export function Step8Notes({ notes, onUpdate }: Step8NotesProps) {
  const [newNote, setNewNote] = useState('');
  const [editingNoteIndex, setEditingNoteIndex] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [newNote]);

  const handleSubmit = () => {
    if (!newNote.trim()) return;
    onUpdate([...notes, newNote.trim()]);
    setNewNote('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // CMD+Enter (Mac) or Ctrl+Enter (Windows/Linux) to submit
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleEdit = (index: number) => {
    setEditingNoteIndex(index);
    setEditingNoteText(notes[index]);
  };

  const handleCancelEdit = () => {
    setEditingNoteIndex(null);
    setEditingNoteText('');
  };

  const handleSaveEdit = (index: number) => {
    if (!editingNoteText.trim()) return;
    const updatedNotes = [...notes];
    updatedNotes[index] = editingNoteText.trim();
    onUpdate(updatedNotes);
    setEditingNoteIndex(null);
    setEditingNoteText('');
  };

  const handleDelete = (index: number) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    onUpdate(notes.filter((_, i) => i !== index));
  };

  const handleEditKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, index: number) => {
    // CMD+Enter (Mac) or Ctrl+Enter (Windows/Linux) to save
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit(index);
    }
    // Escape to cancel
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  // Auto-resize edit textarea
  useEffect(() => {
    if (editTextareaRef.current && editingNoteIndex !== null) {
      editTextareaRef.current.style.height = 'auto';
      editTextareaRef.current.style.height = `${editTextareaRef.current.scrollHeight}px`;
    }
  }, [editingNoteText, editingNoteIndex]);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Session Notes</h3>

      {/* Notes List */}
        <div className="space-y-3">
          {notes.map((note, index) => (
            <Card key={index} className="group">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  {/* Note content */}
                  <div className="flex-1 min-w-0">
                    {editingNoteIndex === index ? (
                      <div className="space-y-2">
                        <Textarea
                          ref={editTextareaRef}
                          value={editingNoteText}
                          onChange={(e) => setEditingNoteText(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, index)}
                          className="min-h-[80px] resize-none text-sm"
                          autoFocus
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSaveEdit(index)}
                            disabled={!editingNoteText.trim()}
                            size="sm"
                            variant="default"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={handleCancelEdit}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
                        {note}
                      </div>
                    )}
                  </div>

                  {/* Actions menu */}
                  {editingNoteIndex !== index && (
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
                          <DropdownMenuItem onClick={() => handleEdit(index)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(index)}
                            className="text-red-600 focus:text-red-600"
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

      {/* New Note Input */}
      <div className="space-y-2 pt-2">
        <Textarea
          ref={textareaRef}
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note..."
          className="min-h-[80px] resize-none text-sm"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {newNote.trim() ? 'Press Cmd+Enter to post' : ''}
          </span>
          <Button
            onClick={handleSubmit}
            disabled={!newNote.trim()}
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


