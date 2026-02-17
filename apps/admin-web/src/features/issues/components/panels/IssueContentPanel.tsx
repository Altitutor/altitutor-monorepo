'use client';

import { useMemo } from 'react';
import { ScrollArea, Button, Tabs, TabsList, TabsTrigger, TabsContent } from '@altitutor/ui';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { useContactIdForRelated } from '@/features/messages/hooks/useContactIdForRelated';
import { StudentCard } from '@/shared/components/StudentCard';
import { StaffCard } from '@/shared/components/StaffCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { SessionCard } from '@/shared/components/SessionCard';
import { InvoiceCard } from '@/shared/components/InvoiceCard';
import { useStudent } from '@/features/students/hooks/useStudentsQuery';
import { useStaffById } from '@/features/staff/hooks/useStaffQuery';
import { useSessionData } from '@/features/sessions/hooks/useSessionData';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import { getContactIdFromConversation } from '@/features/messages/api/queries';
import type { IssueWithTags, IssueTag } from '../../types';
import { MessageSquare, Plus, Tags, User, Users, GraduationCap, Calendar, FileText } from 'lucide-react';
import { cn } from '@/shared/utils';

interface IssueContentPanelProps {
  issue: IssueWithTags;
  isOpen: boolean;
}

export function IssueContentPanel({ issue, isOpen }: IssueContentPanelProps) {
  const conversationTag = issue.tags.find(t => t.conversation_id);
  const studentTag = issue.tags.find(t => t.student_id);
  const contactRelatedId = studentTag?.student_id || undefined;
  
  const { data: contactId } = useQuery({
    queryKey: ['issue-contact', issue.id, conversationTag?.conversation_id, contactRelatedId],
    queryFn: async () => {
      if (conversationTag?.conversation_id) {
        return getContactIdFromConversation(conversationTag.conversation_id);
      }
      if (contactRelatedId) {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from('contacts')
          .select('id')
          .eq('student_id', contactRelatedId)
          .maybeSingle();
        return data?.id || null;
      }
      return null;
    },
    enabled: isOpen && (!!conversationTag || !!contactRelatedId)
  });

  return (
    <div className="hidden md:flex w-80 border-r flex-col min-w-0 flex-shrink-0">
      <Tabs defaultValue="chat" className="flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10 px-6 pb-4 pt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chat">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span>Chat</span>
              </div>
            </TabsTrigger>
            <TabsTrigger value="entities">
              <div className="flex items-center gap-2">
                <Tags className="h-4 w-4" />
                <span>Tagged Entities</span>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0">
          <TabsContent value="chat" className="h-full m-0 data-[state=active]:flex flex-col overflow-hidden">
            {contactId ? (
              <>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                  <MessageThread contactId={contactId} />
                </div>
                <div className="flex-shrink-0 border-t">
                  <Composer contactId={contactId} />
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground p-8 text-center">
                No conversation tagged. Tag a student, staff, or conversation to see messages.
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="entities" className="h-full m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <IssueEntitiesList tags={issue.tags} />
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

function IssueEntitiesList({ tags }: { tags: IssueTag[] }) {
  const studentTags = tags.filter(t => t.student_id);
  const staffTags = tags.filter(t => t.staff_id);
  const classTags = tags.filter(t => t.class_id);
  const sessionTags = tags.filter(t => t.session_id);
  const invoiceTags = tags.filter(t => t.invoice_id);

  return (
    <div className="space-y-6">
      {studentTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <GraduationCap className="h-4 w-4" />
            <span>Students</span>
          </div>
          <div className="grid gap-3">
            {studentTags.map(tag => (
              <StudentCardWrapper key={tag.id} studentId={tag.student_id!} />
            ))}
          </div>
        </section>
      )}

      {staffTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Staff</span>
          </div>
          <div className="grid gap-3">
            {staffTags.map(tag => (
              <StaffCardWrapper key={tag.id} staffId={tag.staff_id!} />
            ))}
          </div>
        </section>
      )}

      {classTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Classes</span>
          </div>
          <div className="grid gap-3">
            {classTags.map(tag => (
              <ClassCardWrapper key={tag.id} classId={tag.class_id!} />
            ))}
          </div>
        </section>
      )}

      {sessionTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Sessions</span>
          </div>
          <div className="grid gap-3">
            {sessionTags.map(tag => (
              <SessionCardWrapper key={tag.id} sessionId={tag.session_id!} />
            ))}
          </div>
        </section>
      )}

      {invoiceTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Invoices</span>
          </div>
          <div className="grid gap-3">
            {invoiceTags.map(tag => (
              <InvoiceCardWrapper key={tag.id} invoiceId={tag.invoice_id!} />
            ))}
          </div>
        </section>
      )}

      {tags.length === 0 && (
        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
          No entities tagged to this issue yet.
        </div>
      )}
    </div>
  );
}

function StudentCardWrapper({ studentId }: { studentId: string }) {
  const { data: student, isLoading } = useStudent(studentId);
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!student) return null;
  return <StudentCard student={student as any} />;
}

function StaffCardWrapper({ staffId }: { staffId: string }) {
  const { data: staff, isLoading } = useStaffById(staffId);
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!staff) return null;
  return <StaffCard staff={staff as any} />;
}

function ClassCardWrapper({ classId }: { classId: string }) {
  // We need a useClass hook or fetch it manually
  const supabase = getSupabaseClient();
  const { data: classData, isLoading } = useQuery({
    queryKey: ['classes', classId],
    queryFn: async () => {
      const { data, error } = await supabase.from('classes').select('*, subject:subjects(*), staff:classes_staff(staff(*))').eq('id', classId).single();
      if (error) throw error;
      return data;
    }
  });
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!classData) return null;
  return <ClassCard class={classData as any} staff={(classData as any).staff?.map((s: any) => s.staff) || []} />;
}

function SessionCardWrapper({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useSessionData({ sessionId });
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!data?.session) return null;
  return <SessionCard session={data.session as any} />;
}

function InvoiceCardWrapper({ invoiceId }: { invoiceId: string }) {
  const supabase = getSupabaseClient();
  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoices', invoiceId],
    queryFn: async () => {
      const { data, error } = await supabase.from('invoices').select('*').eq('id', invoiceId).single();
      if (error) throw error;
      return data;
    }
  });
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!invoice) return null;
  return <InvoiceCard invoice={invoice as any} />;
}
