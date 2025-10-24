'use client';

import { useState } from 'react';
import { Textarea } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { X, Plus } from 'lucide-react';

type Step8NotesProps = {
  notes: string[];
  onUpdate: (notes: string[]) => void;
};

export function Step8Notes({ notes, onUpdate }: Step8NotesProps) {
  const [currentNote, setCurrentNote] = useState('');

  const handleAddNote = () => {
    if (currentNote.trim()) {
      onUpdate([...notes, currentNote.trim()]);
      setCurrentNote('');
    }
  };

  const handleRemoveNote = (index: number) => {
    onUpdate(notes.filter((_, i) => i !== index));
  };

  // Auto-add current note when moving to next step (handled in parent)
  const handleAutoAdd = () => {
    if (currentNote.trim() && !notes.includes(currentNote.trim())) {
      onUpdate([...notes, currentNote.trim()]);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Add any notes about this session (optional). Notes will be automatically added when you press Next.
      </p>

      <div className="space-y-3">
        <Textarea
          placeholder="Type your note here..."
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          rows={4}
          className="resize-none"
        />
        <Button
          variant="outline"
          onClick={handleAddNote}
          disabled={!currentNote.trim()}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Note
        </Button>
      </div>

      {notes.length > 0 && (
        <div className="space-y-2">
          <div className="font-medium">Added Notes</div>
          {notes.map((note, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-3 border rounded-md bg-muted/30"
            >
              <div className="flex-1 text-sm whitespace-pre-wrap">{note}</div>
              <button
                type="button"
                onClick={() => handleRemoveNote(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

