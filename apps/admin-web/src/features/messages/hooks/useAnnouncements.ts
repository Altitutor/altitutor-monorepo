'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { useAuthStore } from '@/shared/lib/supabase/auth';
import type { Database, Tables } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ensureContactForStudent, ensureContactForParent } from '../utils/contactHelpers';

/**
 * Batch create/ensure contacts and conversations for students and parents using a specific sender
 */
async function getOrCreateContactsAndConversationsWithSender(
  studentIds: string[],
  includeParents: boolean,
  ownedNumberId: string
): Promise<{
  studentConversations: Record<string, string>;
  parentConversations: Record<string, string>;
  studentsWithoutPhone: string[];
  parentsWithoutPhone: string[];
}> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  const studentConversations: Record<string, string> = {};
  const parentConversations: Record<string, string> = {};
  const studentsWithoutPhone: string[] = [];
  const parentsWithoutPhone: string[] = [];
  
  // Process students
  for (const studentId of studentIds) {
    try {
      const contactId = await ensureContactForStudent(studentId);
      if (!contactId) {
        studentsWithoutPhone.push(studentId);
        continue;
      }
      
      // Create conversation with specific owned_number_id
      const conversationId = await ensureConversationForContactWithSender(contactId, ownedNumberId);
      if (conversationId) {
        studentConversations[studentId] = conversationId;
      }
    } catch (error) {
      console.error(`Error processing student ${studentId}:`, error);
      studentsWithoutPhone.push(studentId);
    }
  }
  
  // Process parents if requested
  if (includeParents) {
    const { data: parentStudents, error: psError } = await supabase
      .from('parents_students')
      .select(`
        parent_id,
        parents (
          id,
          phone
        )
      `)
      .in('student_id', studentIds);
    
    if (psError) {
      console.error('Error fetching parents:', psError);
      return { studentConversations, parentConversations, studentsWithoutPhone, parentsWithoutPhone };
    }
    
    const uniqueParentIds = Array.from(
      new Set(
        (parentStudents || [])
          .map((ps: any) => ps.parent_id)
          .filter(Boolean)
      )
    );
    
    for (const parentId of uniqueParentIds) {
      try {
        const contactId = await ensureContactForParent(parentId);
        if (!contactId) {
          parentsWithoutPhone.push(parentId);
          continue;
        }
        
        const conversationId = await ensureConversationForContactWithSender(contactId, ownedNumberId);
        if (conversationId) {
          parentConversations[parentId] = conversationId;
        }
      } catch (error) {
        console.error(`Error processing parent ${parentId}:`, error);
        parentsWithoutPhone.push(parentId);
      }
    }
  }
  
  return {
    studentConversations,
    parentConversations,
    studentsWithoutPhone,
    parentsWithoutPhone,
  };
}

async function ensureConversationForContactWithSender(contactId: string, ownedNumberId: string): Promise<string | null> {
  const supabase = getSupabaseClient() as SupabaseClient<Database>;
  
  // Try find active conversation
  const { data: existing, error: findErr } = await supabase
    .from('conversations')
    .select('id')
    .eq('contact_id', contactId)
    .eq('owned_number_id', ownedNumberId)
    .in('status', ['OPEN', 'SNOOZED'])
    .limit(1)
    .maybeSingle();
  
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  // Create - with error handling for duplicate constraint
  const { data: created, error: createErr } = await supabase
    .from('conversations')
    .insert({ contact_id: contactId, owned_number_id: ownedNumberId, status: 'OPEN' })
    .select('id')
    .maybeSingle();
  
  // If duplicate key error, retry the select
  if (createErr && createErr.code === '23505') {
    const { data: retry } = await supabase
      .from('conversations')
      .select('id')
      .eq('contact_id', contactId)
      .eq('owned_number_id', ownedNumberId)
      .in('status', ['OPEN', 'SNOOZED'])
      .limit(1)
      .maybeSingle();
    if (retry?.id) return retry.id;
  }
  
  if (createErr) throw createErr;
  return created?.id || null;
}
import { getStudentClasses } from '../api/bulk';
import { replaceVariables } from '../utils/variableReplacer';
import { getErrorMessage } from '@/shared/utils';
import { batchGenerateLinkTokens, templateContainsLinkVariables } from '../utils/generateLinkTokens';

const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 200;

interface AnnouncementSendResult {
  sent: number;
  failed: number;
  skipped: number;
  errors: Array<{ recipientId: string; error: string }>;
}

export function useAnnouncements() {
  const qc = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [isLoading, setIsLoading] = useState(false);

  const sendAnnouncements = async (
    students: Tables<'students'>[],
    message: string,
    sendToParents: boolean,
    selectedSenderId: string
  ): Promise<AnnouncementSendResult> => {
    setIsLoading(true);
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    
    const result: AnnouncementSendResult = {
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Get staff ID and name
      const { data: staffRow } = await supabase
        .from('staff')
        .select('id, first_name, last_name')
        .eq('user_id', user?.id || '')
        .maybeSingle();

      const staffId = staffRow?.id || null;
      const senderName = staffRow 
        ? `${staffRow.first_name || ''} ${staffRow.last_name || ''}`.trim() 
        : null;

      // 1. Get selected sender details first (needed for conversation creation)
      const { data: selectedSender, error: senderErr } = await supabase
        .from('owned_numbers')
        .select('id, phone_e164, alphanumeric_sender_id, sender_type, label')
        .eq('id', selectedSenderId)
        .maybeSingle();

      if (senderErr || !selectedSender) {
        throw new Error('Selected sender not found');
      }

      // 2. Create/ensure contacts and conversations for all students and parents
      // Use a custom function that uses the selected sender's owned_number_id
      const studentIds = students.map(s => s.id);
      const {
        studentConversations,
        parentConversations,
        studentsWithoutPhone,
        parentsWithoutPhone,
      } = await getOrCreateContactsAndConversationsWithSender(studentIds, sendToParents, selectedSender.id);

      result.skipped = studentsWithoutPhone.length + parentsWithoutPhone.length;

      // 3. Load classes for all students
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

      // 3.5. Generate link tokens if template contains link variables
      const needsLinks = templateContainsLinkVariables(message);
      let linkTokensMap: Record<string, import('../utils/generateLinkTokens').LinkTokens> = {};
      
      if (needsLinks) {
        try {
          linkTokensMap = await batchGenerateLinkTokens(studentIds, {
            includeRegistration: message.includes('{registration_link}'),
            includeInvite: message.includes('{invite_link}'),
            includePasswordReset: message.includes('{forgot_password_link}'),
          });
        } catch (error) {
          console.error('Error batch generating link tokens:', error);
          // Continue without tokens - variables will be replaced with empty strings
        }
      }

      // Determine from value based on sender type
      const fromValue = selectedSender.sender_type === 'ALPHANUMERIC'
        ? selectedSender.alphanumeric_sender_id
        : selectedSender.phone_e164;

      if (!fromValue) {
        throw new Error('Selected sender has no valid from value');
      }

      // 4. Prepare all messages
      const messages: Array<{
        conversationId: string;
        body: string;
        fromNumber: string;
        toNumber: string;
      }> = [];

      // Add student messages
      for (const student of students) {
        const conversationId = studentConversations[student.id];
        if (!conversationId || !student.phone) continue;

        const classes = studentClassesMap[student.id] || [];
        const linkTokens = linkTokensMap[student.id];
        const personalizedMessage = replaceVariables(message, student, classes, senderName, linkTokens || undefined);

        messages.push({
          conversationId,
          body: personalizedMessage,
          fromNumber: fromValue,
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
          const linkTokens = linkTokensMap[studentId];
          const personalizedMessage = replaceVariables(message, student, classes, senderName, linkTokens || undefined);

          messages.push({
            conversationId,
            body: personalizedMessage,
            fromNumber: fromValue,
            toNumber: parent.phone,
          });
        }
      }

      // 5. Send messages in batches
      setProgress({ current: 0, total: messages.length });

      for (let i = 0; i < messages.length; i += BATCH_SIZE) {
        const batch = messages.slice(i, i + BATCH_SIZE);

        // Send batch in parallel
        await Promise.allSettled(
          batch.map(async (msg) => {
            try {
              // Create message row (QUEUED) with is_announcement flag
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
                  is_announcement: true,
                })
                .select('id')
                .single();

              if (insertErr) throw insertErr;

              // Fire-and-forget the send to avoid blocking UI
              supabase.functions
                .invoke('send-message', { body: { messageId: created.id } })
                .catch((e: unknown) => {
                  const errMsg = getErrorMessage(e);
                  console.error('[send-message invoke] error', errMsg);
                });

              result.sent++;
            } catch (error: unknown) {
              const errorMessage = getErrorMessage(error);
              result.failed++;
              result.errors.push({
                recipientId: msg.conversationId,
                error: errorMessage || 'Unknown error',
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
    } catch (error: unknown) {
      console.error('Announcement send error:', error);
      throw error;
    } finally {
      setIsLoading(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return {
    sendAnnouncements,
    isLoading,
    progress,
  };
}
