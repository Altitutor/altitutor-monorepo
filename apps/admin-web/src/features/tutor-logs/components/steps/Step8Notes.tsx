'use client';

import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@altitutor/ui';

type Step8NotesProps = {
  title?: string;
  notes: string[];
  onUpdate: (notes: string[]) => void;
};

export function Step8Notes({ title, notes, onUpdate }: Step8NotesProps) {
  // Get the first note if it exists, otherwise empty string
  const [noteText, setNoteText] = useState(notes[0] || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local state when notes prop changes (e.g., when navigating back)
  useEffect(() => {
    setNoteText(notes[0] || '');
  }, [notes]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [noteText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setNoteText(value);
    // Update formData immediately - convert to array (single element or empty)
    onUpdate(value.trim() ? [value.trim()] : []);
  };

  return (
    <div className="space-y-4">
      {title && <h2 className="text-xl font-semibold">{title}</h2>}
      <Textarea
        ref={textareaRef}
        value={noteText}
        onChange={handleChange}
        placeholder="Add session notes..."
        className="min-h-[120px] resize-none text-sm"
      />
    </div>
  );
}
