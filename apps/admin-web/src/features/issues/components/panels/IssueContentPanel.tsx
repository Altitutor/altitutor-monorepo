'use client';

import { useMemo, memo, useState, useEffect } from 'react';
import { Skeleton, SegmentedControl } from '@altitutor/ui';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { IssueTag, IssueFormData } from '../../types';
import { MessageCircle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { IssueStatusField } from '../fields/IssueStatusField';
import { IssueDueDateField } from '../fields/IssueDueDateField';
import { EntitySidebarCard, EntitySidebarCards } from '@/shared/components/EntitySidebarCard';

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-start gap-3">
      <span className="pt-2.5 text-sm font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface IssueContentPanelProps {
  tags?: IssueTag[];
  isOpen: boolean;
  form: UseFormReturn<IssueFormData>;
}

export const IssueContentPanel = memo(function IssueContentPanel({ tags: propTags, isOpen, form }: IssueContentPanelProps) {
  const activeTags = useMemo(() => propTags || [], [propTags]);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  
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

  useEffect(() => {
    if (!contacts?.length) {
      setActiveContactId(null);
      return;
    }

    setActiveContactId((current) => (
      current && contacts.some((contact) => contact.id === current)
        ? current
        : contacts[0].id
    ));
  }, [contacts]);

  return (
    <div className="hidden h-full min-h-0 w-full flex-col overflow-hidden min-w-0 md:flex">
      <EntitySidebarCards defaultOpen={['properties', 'chat']}>
        <EntitySidebarCard value="properties" title="Properties">
          <div className="space-y-4">
            <PropertyRow label="Status">
              <IssueStatusField form={form} />
            </PropertyRow>
            <PropertyRow label="Due date">
              <IssueDueDateField form={form} />
            </PropertyRow>
          </div>
        </EntitySidebarCard>

        <EntitySidebarCard value="chat" title="Chat" flush>
          {isLoadingContacts ? (
            <div className="space-y-4 p-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-[280px] w-full" />
            </div>
          ) : contacts && contacts.length > 0 && activeContactId ? (
            <div className="flex h-[22rem] flex-col overflow-hidden">
              {contacts.length > 1 ? (
                <div className="flex-shrink-0 border-b p-2">
                  <SegmentedControl
                    fullWidth
                    size="sm"
                    value={activeContactId}
                    onValueChange={setActiveContactId}
                    aria-label="Chat contact"
                    options={contacts.map((contact) => ({
                      value: contact.id,
                      label: contact.name,
                    }))}
                  />
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <div className="min-h-0 flex-1 overflow-hidden">
                  <MessageThread contactId={activeContactId} hideAddIssueHover />
                </div>
                <div className="flex-shrink-0 border-t bg-background">
                  <Composer contactId={activeContactId} />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[12rem] flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 text-muted/50" />
              <p className="text-sm">Mention a student, staff member, or parent to show their chat here.</p>
            </div>
          )}
        </EntitySidebarCard>
      </EntitySidebarCards>
    </div>
  );
});
