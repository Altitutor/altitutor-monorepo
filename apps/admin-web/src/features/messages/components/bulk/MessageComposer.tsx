'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button, Textarea, ScrollArea } from '@altitutor/ui';
import { MessageTemplatesPicker } from '../MessageTemplatesPicker';
import { replaceVariables } from '../../utils/variableReplacer';
import { getStudentClasses } from '../../api/bulk';
import type { Tables } from '@altitutor/shared';

interface MessageComposerProps {
  students: Tables<'students'>[];
  message: string;
  onMessageChange: (message: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function MessageComposer({
  students,
  message,
  onMessageChange,
  onNext,
  onBack,
}: MessageComposerProps) {
  const [previewIndex, setPreviewIndex] = useState(0);
  const [studentClasses, setStudentClasses] = useState<
    Record<string, Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>>
  >({});
  const [isLoadingClasses, setIsLoadingClasses] = useState(false);

  const currentStudent = students[previewIndex];

  // Load classes for current student
  useEffect(() => {
    if (!currentStudent) return;
    
    const loadClasses = async () => {
      if (studentClasses[currentStudent.id]) return; // Already loaded
      
      setIsLoadingClasses(true);
      try {
        const classes = await getStudentClasses(currentStudent.id);
        setStudentClasses(prev => ({
          ...prev,
          [currentStudent.id]: classes,
        }));
      } catch (error) {
        console.error('Error loading student classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }
    };
    
    loadClasses();
  }, [currentStudent, studentClasses]);

  const handleTemplateSelect = (template: Tables<'message_templates'>) => {
    onMessageChange(template.content);
  };

  const previewMessage = currentStudent && studentClasses[currentStudent.id]
    ? replaceVariables(message, currentStudent, studentClasses[currentStudent.id] || [])
    : message;

  const handlePrevious = () => {
    setPreviewIndex(Math.max(0, previewIndex - 1));
  };

  const handleNext = () => {
    setPreviewIndex(Math.min(students.length - 1, previewIndex + 1));
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Compose Message</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Write your message using variables like {'{first_name}'}, {'{last_name}'}, {'{classes}'}
        </p>
      </div>

      <div className="flex-1 p-6 grid grid-cols-2 gap-6 overflow-hidden">
        {/* Message Input */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Message Template</h3>
            <MessageTemplatesPicker onSelect={handleTemplateSelect} />
          </div>
          <Textarea
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="Type your message here..."
            className="flex-1 resize-none font-mono text-sm"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            <p className="font-semibold mb-1">Available variables:</p>
            <p>• {'{first_name}'} - Student's first name</p>
            <p>• {'{last_name}'} - Student's last name</p>
            <p>• {'{classes}'} - Student's enrolled classes (formatted list)</p>
          </div>
        </div>

        {/* Preview */}
        <div className="flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Preview</h3>
            {students.length > 1 && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handlePrevious}
                  disabled={previewIndex === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground">
                  {previewIndex + 1} / {students.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleNext}
                  disabled={previewIndex === students.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {currentStudent && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="mb-3 p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">
                  {currentStudent.first_name} {currentStudent.last_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {currentStudent.phone || 'No phone number'}
                </p>
              </div>

              <ScrollArea className="flex-1 border rounded-lg p-4 bg-muted/30">
                {isLoadingClasses ? (
                  <div className="text-sm text-muted-foreground">
                    Loading preview...
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div className="max-w-[80%] bg-brand-lightBlue text-brand-dark-bg rounded-lg px-4 py-2">
                      <p className="text-sm whitespace-pre-wrap break-words">
                        {previewMessage}
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!message.trim()}
        >
          Next
        </Button>
      </div>
    </div>
  );
}




