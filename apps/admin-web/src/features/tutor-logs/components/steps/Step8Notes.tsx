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
  const [isUserTyping, setIsUserTyping] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update local state when notes prop changes (e.g., when navigating back)
  // Only sync if user is not actively typing to prevent overwriting their input
  useEffect(() => {
    if (!isUserTyping) {
      const newNoteText = notes[0] || '';
      setNoteText(newNoteText);
    }
  }, [notes, isUserTyping]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [noteText]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setIsUserTyping(true);
    setNoteText(value);
    // Store raw value (with spaces) in formData - only trim on submit
    // Update formData immediately - convert to array (single element or empty)
    onUpdate(value ? [value] : []);
  };

  // Reset typing flag when user stops typing (after a delay)
  useEffect(() => {
    if (isUserTyping) {
      const timer = setTimeout(() => {
        setIsUserTyping(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [noteText, isUserTyping]);

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
