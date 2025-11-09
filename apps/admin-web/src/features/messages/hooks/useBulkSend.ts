'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateContactsAndConversations } from '../utils/contactHelpers';
import { getStudentClasses } from '../api/bulk';
import { replaceVariables } from '../utils/variableReplacer';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

interface BulkSendResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ recipientId: string; error: string }>;
}

export function useBulkSend() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const sendBulkMessages = async (
    students: Tables<'students'>[],
    message: string,
    sendToParents: boolean
  ): Promise<BulkSendResult> => {
    setIsLoading(true);
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const result: BulkSendResult = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get staff ID
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const staffId = staffRow?.id || null;

      // 1. Create/ensure contacts and conversations for all students and parents
      const studentIds = students.map(s => s.id);
      const {
        studentConversations,
        parentConversations,
        studentsWithoutPhone,
        parentsWithoutPhone,
      } = await getOrCreateContactsAndConversations(studentIds, sendToParents);

      result.skipped = studentsWithoutPhone.length + parentsWithoutPhone.length;

      // 2. Load classes for all students
      const studentClassesMap: Record<string, Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>> = {};
      for (const student of students) {
        try {
          const classes = await getStudentClasses(student.id);
          studentClassesMap[student.id] = classes;
        } catch (error) {
          console.error(`Error loading classes for student ${student.id}:`, error);
          studentClassesMap[student.id] = [];
        }
      }

      // 3. Prepare all messages
      const messages: Array<{
        conversationId: string;
        body: string;
        fromNumber: string;
        toNumber: string;
      }> = [];

      // Get default owned number
      const { data: ownedNumber } = await supabase
        .from('owned_numbers')
        .select('phone_e164')
        .eq('is_default', true)
        .maybeSingle();

      if (!ownedNumber?.phone_e164) {
        throw new Error('No default owned number configured');
      }

      const fromNumber = ownedNumber.phone_e164;

      // Add student messages
      for (const student of students) {
        const conversationId = studentConversations[student.id];
        if (!conversationId || !student.phone) continue;

        const classes = studentClassesMap[student.id] || [];
        const personalizedMessage = replaceVariables(message, student, classes);

        messages.push({
          conversationId,
          body: personalizedMessage,
          fromNumber,
          toNumber: student.phone,
        });
      }

      // Add parent messages
      if (sendToParents) {
        // Get all parents with their students
        const { data: parentStudents } = await supabase
          .from('parents_students')
          .select(`
            parent_id,
            student_id,
            parents (
              id,
              phone
            )
          `)
          .in('student_id', studentIds);

        for (const ps of (parentStudents || [])) {
          const parentId = (ps as any).parent_id;
          const studentId = (ps as any).student_id;
          const parent = (ps as any).parents;

          if (!parent?.phone) continue;

          const conversationId = parentConversations[parentId];
          if (!conversationId) continue;

          // Use the student's data for variable replacement
          const student = students.find(s => s.id === studentId);
          if (!student) continue;

          const classes = studentClassesMap[studentId] || [];
          const personalizedMessage = replaceVariables(message, student, classes);

          messages.push({
            conversationId,
            body: personalizedMessage,
            fromNumber,
            toNumber: parent.phone,
          });
        }
      }

      // 4. Send messages in batches
      setProgress({ current: 0, total: messages.length });

      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);

        // Send batch in parallel
        await Promise.allSettled(
          batch.map(async (msg) => {
            try {
              // Create message row (QUEUED)
              const { data: created, error: insertErr } = await supabase
                .from('messages')
                .insert({
                  conversation_id: msg.conversationId,
                  direction: 'OUTBOUND',
                  body: msg.body,
                  status: 'QUEUED',
                  created_by_staff_id: staffId,
                  from_number_e164: msg.fromNumber,
                  to_number_e164: msg.toNumber,
                })
                .select('id')
                .single();

              if (insertErr) throw insertErr;

              // Fire-and-forget the send to avoid blocking UI
              supabase.functions
                .invoke('send-sms', { body: { messageId: created.id } })
                .catch((e: any) => console.error('[send-sms invoke] error', e?.message || e));

              result.sent++;
            } catch (error: any) {
              result.failed++;
              result.errors.push({
                recipientId: msg.conversationId,
                error: error.message || 'Unknown error',
              });
            }
          })
        );

        // Update progress
        setProgress({ current: Math.min(i + BATCH_SIZE, messages.length), total: messages.length });

        // Delay between batches (except for the last batch)
        if (i + BATCH_SIZE < messages.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      // Invalidate queries
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['messages'] });

      return result;
    } catch (error: any) {
      console.error('Bulk send error:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return {
    sendBulkMessages,
    isLoading,
    progress,
  };
}



