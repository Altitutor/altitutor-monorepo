'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button, ScrollArea, Alert, AlertDescription } from '@altitutor/ui';
import { replaceVariables } from '../../utils/variableReplacer';
import { getStudentClasses } from '../../api/bulk';
import type { Tables } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Recipient {
  id: string;
  type: 'student' | 'parent';
  name: string;
  phone: string | null;
  studentId?: string; // For parents, reference to their student
}

interface MessagePreviewProps {
  students: Tables<'students'>[];
  message: string;
  sendToParents: boolean;
  onSend: () => void;
  onBack: () => void;
  isSending?: boolean;
}

export function MessagePreview({
  students,
  message,
  sendToParents,
  onSend,
  onBack,
  isSending = false,
}: MessagePreviewProps) {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [studentClasses, setStudentClasses] = useState<
    Record<string, Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  // Load all recipients and their classes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      try {
        const allRecipients: Recipient[] = [];
        const classesMap: Record<string, Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>> = {};

        // Add students as recipients
        for (const student of students) {
          allRecipients.push({
            id: student.id,
            type: 'student',
            name: `${student.first_name} ${student.last_name}`,
            phone: student.phone,
          });

          // Load student classes
          const classes = await getStudentClasses(student.id);
          classesMap[student.id] = classes;
        }

        // Add parents if requested
        if (sendToParents) {
          const studentIds = students.map(s => s.id);
          const { data: parentStudents, error } = await supabase
            .from('parents_students')
            .select(`
              parent_id,
              student_id,
              parents (
                id,
                first_name,
                last_name,
                phone
              )
            `)
            .in('student_id', studentIds);

          if (error) {
            console.error('Error fetching parents:', error);
          } else {
            (parentStudents || []).forEach((ps: any) => {
              if (ps.parents) {
                allRecipients.push({
                  id: `parent-${ps.parent_id}`,
                  type: 'parent',
                  name: `${ps.parents.first_name} ${ps.parents.last_name}`,
                  phone: ps.parents.phone,
                  studentId: ps.student_id,
                });
              }
            });
          }
        }

        setRecipients(allRecipients);
        setStudentClasses(classesMap);
        
        // Select first recipient
        if (allRecipients.length > 0) {
          setSelectedRecipientId(allRecipients[0].id);
        }
      } catch (error) {
        console.error('Error loading preview data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [students, sendToParents]);

  const recipientsWithPhone = recipients.filter(r => r.phone);
  const recipientsWithoutPhone = recipients.filter(r => !r.phone);

  const selectedRecipient = recipients.find(r => r.id === selectedRecipientId);

  // Get preview message for selected recipient
  const getPreviewMessage = () => {
    if (!selectedRecipient) return message;

    // For parents, use their student's data
    const studentId = selectedRecipient.type === 'parent' 
      ? selectedRecipient.studentId 
      : selectedRecipient.id;

    const student = students.find(s => s.id === studentId);
    if (!student) return message;

    const classes = studentClasses[studentId] || [];
    return replaceVariables(message, student, classes);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Preview & Send</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Review recipients and their personalized messages before sending
        </p>
      </div>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading recipients...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="p-6 space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold">{recipientsWithPhone.length}</div>
                <div className="text-sm text-muted-foreground">Will receive message</div>
              </div>
              <div className="border rounded-lg p-4">
                <div className="text-2xl font-bold">{students.length}</div>
                <div className="text-sm text-muted-foreground">Students</div>
              </div>
              {sendToParents && (
                <div className="border rounded-lg p-4">
                  <div className="text-2xl font-bold">
                    {recipients.filter(r => r.type === 'parent').length}
                  </div>
                  <div className="text-sm text-muted-foreground">Parents</div>
                </div>
              )}
            </div>

            {/* Warning for missing phones */}
            {recipientsWithoutPhone.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {recipientsWithoutPhone.length} recipient{recipientsWithoutPhone.length !== 1 ? 's' : ''} without phone numbers will be skipped
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="flex-1 p-6 grid grid-cols-2 gap-6 overflow-hidden">
            {/* Recipients List */}
            <div className="flex flex-col">
              <h3 className="font-semibold text-sm mb-3">Recipients</h3>
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="p-2">
                  {recipients.map((recipient) => (
                    <button
                      key={recipient.id}
                      onClick={() => setSelectedRecipientId(recipient.id)}
                      className={`w-full text-left p-3 rounded-md transition-colors ${
                        selectedRecipientId === recipient.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      } ${!recipient.phone ? 'opacity-50' : ''}`}
                      disabled={!recipient.phone}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{recipient.name}</div>
                          <div className="text-xs mt-0.5">
                            {recipient.type === 'parent' ? '👤 Parent' : '🎓 Student'}
                            {!recipient.phone && ' • No phone'}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Message Preview */}
            <div className="flex flex-col">
              <h3 className="font-semibold text-sm mb-3">Message Preview</h3>
              {selectedRecipient ? (
                <div className="flex flex-col flex-1 overflow-hidden border rounded-lg bg-muted/30">
                  <div className="p-3 border-b bg-background">
                    <div className="font-medium text-sm">{selectedRecipient.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {selectedRecipient.phone || 'No phone number'}
                    </div>
                  </div>
                  <ScrollArea className="flex-1 p-4">
                    <div className="flex justify-end">
                      <div className="max-w-[80%] bg-brand-lightBlue text-brand-dark-bg rounded-lg px-4 py-2">
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {getPreviewMessage()}
                        </p>
                      </div>
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Select a recipient to preview their message
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="p-6 border-t flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSending}>
          Back
        </Button>
        <Button
          onClick={onSend}
          disabled={recipientsWithPhone.length === 0 || isSending || isLoading}
        >
          {isSending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            `Send ${recipientsWithPhone.length} Message${recipientsWithPhone.length !== 1 ? 's' : ''}`
          )}
        </Button>
      </div>
    </div>
  );
}



