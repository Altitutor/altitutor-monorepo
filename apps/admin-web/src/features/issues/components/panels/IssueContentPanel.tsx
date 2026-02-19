'use client';

import { useMemo, memo } from 'react';
import { ScrollArea, ScrollBar, Button, Tabs, TabsList, TabsTrigger, TabsContent, Badge, Skeleton } from '@altitutor/ui';
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
import { getContactIdFromConversation, useContactHeader } from '@/features/messages/api/queries';
import { ParentCard } from '@/shared/components/ParentCard';
import type { IssueWithTags, IssueTag } from '../../types';
import { MessageSquare, Plus, Tags, User, Users, GraduationCap, Calendar, FileText, BookOpen, MessageCircle } from 'lucide-react';
import { cn, getSubjectColorStyle, formatSubjectShortName } from '@/shared/utils';

const handleEntityClick = (type: string, id: string) => {
  window.dispatchEvent(new CustomEvent('mentionClick', { 
    detail: { id, type } 
  }));
};

interface IssueContentPanelProps {
  issue?: IssueWithTags;
  tags?: any[];
  isOpen: boolean;
}

export const IssueContentPanel = memo(function IssueContentPanel({ issue, tags: propTags, isOpen }: IssueContentPanelProps) {
  const activeTags = useMemo(() => issue?.tags || propTags || [], [issue?.tags, propTags]);
  
  // Get all unique entity IDs from tags
  const studentIds = useMemo(() => Array.from(new Set(activeTags.filter(t => t.student_id).map(t => t.student_id!))), [activeTags]);
  const staffIds = useMemo(() => Array.from(new Set(activeTags.filter(t => t.staff_id).map(t => t.staff_id!))), [activeTags]);
  const parentIds = useMemo(() => Array.from(new Set(activeTags.filter(t => t.parent_id).map(t => t.parent_id!))), [activeTags]);

  const { data: contacts, isLoading: isLoadingContacts } = useQuery({
    queryKey: ['issue-contacts', activeTags.map(t => t.id).join(',')],
    queryFn: async () => {
      const supabase = getSupabaseClient();
      const results: Array<{ id: string; name: string; type: 'student' | 'staff' | 'parent' }> = [];

      if (studentIds.length > 0) {
        const { data } = await supabase
          .from('contacts')
          .select('id, student_id, students(first_name, last_name)')
          .in('student_id', studentIds);
        
        data?.forEach(c => {
          if (c.students) {
            results.push({
              id: c.id,
              name: `${c.students.first_name || ''} ${c.students.last_name || ''}`.trim() || 'Student',
              type: 'student'
            });
          }
        });
      }

      if (staffIds.length > 0) {
        const { data } = await supabase
          .from('contacts')
          .select('id, staff_id, staff(first_name, last_name)')
          .in('staff_id', staffIds);
        
        data?.forEach(c => {
          if (c.staff) {
            results.push({
              id: c.id,
              name: `${c.staff.first_name || ''} ${c.staff.last_name || ''}`.trim() || 'Staff',
              type: 'staff'
            });
          }
        });
      }

      if (parentIds.length > 0) {
        const { data } = await supabase
          .from('contacts')
          .select('id, parent_id, parents(first_name, last_name)')
          .in('parent_id', parentIds);
        
        data?.forEach(c => {
          if (c.parents) {
            results.push({
              id: c.id,
              name: `${c.parents.first_name || ''} ${c.parents.last_name || ''}`.trim() || 'Parent',
              type: 'parent'
            });
          }
        });
      }

      return results;
    },
    enabled: isOpen && (studentIds.length > 0 || staffIds.length > 0 || parentIds.length > 0)
  });

  if (!issue && activeTags.length === 0) {
    return (
      <div className="hidden md:flex w-80 border-l flex-col min-w-0 flex-shrink-0 items-center justify-center p-8 text-center text-muted-foreground">
        Tag entities after creating the issue to see chat and related data.
      </div>
    );
  }

  return (
    <div className="hidden md:flex w-80 border-l flex-col min-w-0 flex-shrink-0">
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
                <span>Tagged</span>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <TabsContent value="chat" className="h-full min-h-0 m-0 data-[state=active]:flex flex-col overflow-hidden">
            {isLoadingContacts ? (
              <div className="p-4 space-y-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-[400px] w-full" />
              </div>
            ) : contacts && contacts.length > 0 ? (
              <Tabs defaultValue={contacts[0].id} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-shrink-0 border-b bg-muted/30">
                  <ScrollArea className="w-full">
                    <TabsList className="h-9 w-max justify-start bg-transparent p-0 rounded-none border-b-0">
                      {contacts.map((contact) => (
                        <TabsTrigger
                          key={contact.id}
                          value={contact.id}
                          className="px-4 py-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent transition-none"
                        >
                          <span className="text-xs font-medium whitespace-nowrap">
                            {contact.name}
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>

                {contacts.map((contact) => (
                  <TabsContent
                    key={contact.id}
                    value={contact.id}
                    className="flex-1 min-h-0 m-0 data-[state=active]:flex flex-col overflow-hidden"
                  >
                    <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                      <MessageThread contactId={contact.id} hideAddIssueHover />
                    </div>
                    <div className="flex-shrink-0 border-t">
                      <Composer contactId={contact.id} />
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center gap-3">
                <MessageCircle className="h-12 w-12 text-muted/50" />
                <p className="text-sm">No students, staff, or parents tagged. Tag someone to start a chat.</p>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="entities" className="h-full m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-6">
                <IssueEntitiesList tags={activeTags} />
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
});

const IssueEntitiesList = memo(function IssueEntitiesList({ tags }: { tags: IssueTag[] }) {
  const studentTags = useMemo(() => tags.filter(t => t.student_id), [tags]);
  const staffTags = useMemo(() => tags.filter(t => t.staff_id), [tags]);
  const parentTags = useMemo(() => tags.filter(t => t.parent_id), [tags]);
  const classTags = useMemo(() => tags.filter(t => t.class_id), [tags]);
  const subjectTags = useMemo(() => tags.filter(t => t.subject_id), [tags]);
  const sessionTags = useMemo(() => tags.filter(t => t.session_id), [tags]);
  const invoiceTags = useMemo(() => tags.filter(t => t.invoice_id), [tags]);

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

      {parentTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Users className="h-4 w-4" />
            <span>Parents</span>
          </div>
          <div className="grid gap-3">
            {parentTags.map(tag => (
              <ParentCardWrapper key={tag.id} parentId={tag.parent_id!} />
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
            <Calendar className="h-4 w-4" />
            <span>Classes</span>
          </div>
          <div className="grid gap-3">
            {classTags.map(tag => (
              <ClassCardWrapper key={tag.id} classId={tag.class_id!} />
            ))}
          </div>
        </section>
      )}

      {subjectTags.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span>Subjects</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {subjectTags.map(tag => (
              <SubjectPillWrapper key={tag.id} subjectId={tag.subject_id!} />
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
});

function StudentCardWrapper({ studentId }: { studentId: string }) {
  const { data: student, isLoading } = useStudent(studentId);
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!student) return null;
  return <StudentCard student={student as any} onClick={() => handleEntityClick('student', studentId)} />;
}

function ParentCardWrapper({ parentId }: { parentId: string }) {
  const supabase = getSupabaseClient();
  const { data: parent, isLoading } = useQuery({
    queryKey: ['parents', parentId],
    queryFn: async () => {
      const { data, error } = await supabase.from('parents').select('*').eq('id', parentId).single();
      if (error) throw error;
      return data;
    }
  });
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!parent) return null;
  return <ParentCard parent={parent as any} onClick={() => handleEntityClick('parent', parentId)} />;
}

function StaffCardWrapper({ staffId }: { staffId: string }) {
  const { data: staff, isLoading } = useStaffById(staffId);
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!staff) return null;
  return <StaffCard staff={staff as any} onClick={() => handleEntityClick('staff', staffId)} />;
}

function ClassCardWrapper({ classId }: { classId: string }) {
  // We need a useClass hook or fetch it manually
  const supabase = getSupabaseClient();
  const { data: classData, isLoading } = useQuery({
    queryKey: ['classes', classId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('*, subject:subjects(*), assigned_staff:classes_staff(staff:staff!class_assignments_staff_id_fkey(*))')
        .eq('id', classId)
        .single();
      
      if (error) {
        throw error;
      }
      return data;
    }
  });

  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!classData) {
    return null;
  }
  
  const staff = (classData as any).assigned_staff?.map((s: any) => s.staff).filter(Boolean) || [];
  
  return (
    <ClassCard 
      class={classData as any} 
      subject={(classData as any).subject}
      staff={staff} 
      onClick={() => handleEntityClick('class', classId)}
    />
  );
}

function SubjectPillWrapper({ subjectId }: { subjectId: string }) {
  const supabase = getSupabaseClient();
  const { data: subject, isLoading } = useQuery({
    queryKey: ['subjects', subjectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('subjects').select('*').eq('id', subjectId).single();
      if (error) {
        throw error;
      }
      return data;
    }
  });

  if (isLoading) return <div className="h-6 w-16 bg-muted animate-pulse rounded-full" />;
  if (!subject) {
    return null;
  }
  
  const shortName = formatSubjectShortName(subject as any);
  const { style, textColorClass } = getSubjectColorStyle(subject as any);
  const defaultClass = !subject.color ? 'bg-gray-100 text-gray-800' : '';

  return (
    <Badge
      className={cn(
        "cursor-pointer hover:opacity-80 transition-opacity",
        defaultClass || textColorClass
      )}
      style={style.backgroundColor ? style : undefined}
      onClick={() => handleEntityClick('subject', subjectId)}
    >
      {shortName}
    </Badge>
  );
}

function SessionCardWrapper({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useSessionData({ sessionId });
  if (isLoading) return <div className="h-24 bg-muted animate-pulse rounded-lg" />;
  if (!data?.session) return null;
  return <SessionCard session={data.session as any} onClick={() => handleEntityClick('session', sessionId)} />;
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
  return <InvoiceCard invoice={invoice as any} onClick={() => handleEntityClick('invoice', invoiceId)} />;
}
