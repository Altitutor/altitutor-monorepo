'use client';

import { useMemo, memo, useState } from 'react';
import { ScrollArea, ScrollBar, Tabs, TabsList, TabsTrigger, TabsContent, Skeleton, SegmentedControl, SegmentedTabPanelContent } from '@altitutor/ui';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { Composer } from '@/features/messages/components/Composer';
import { useQuery } from '@tanstack/react-query';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { IssueTag, IssueFormData } from '../../types';
import { MessageCircle } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { IssueStatusField } from '../fields/IssueStatusField';
import { IssueDueDateField } from '../fields/IssueDueDateField';

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
  const [activeTab, setActiveTab] = useState<'properties' | 'chat'>('properties');
  const activeTags = useMemo(() => propTags || [], [propTags]);
  
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

  return (
    <div className="hidden h-full min-h-0 w-full flex-col overflow-hidden min-w-0 md:flex">
      <div className="h-full flex-1 flex flex-col min-h-0">
        <div className="flex-shrink-0 border-b bg-background sticky top-0 z-10 px-6 pb-4 pt-4">
          <SegmentedControl
            fullWidth
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'properties' | 'chat')}
            options={[
              { value: 'properties', label: 'Properties' },
              { value: 'chat', label: 'Chat' },
            ]}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <SegmentedTabPanelContent when="properties" activeTab={activeTab} className="h-full overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-6 space-y-4">
                <PropertyRow label="Status">
                  <IssueStatusField form={form} />
                </PropertyRow>
                <PropertyRow label="Due date">
                  <IssueDueDateField form={form} />
                </PropertyRow>
              </div>
            </ScrollArea>
          </SegmentedTabPanelContent>

          <SegmentedTabPanelContent when="chat" activeTab={activeTab} className="h-full min-h-0 flex flex-col overflow-hidden">
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
                <p className="text-sm">Mention a student, staff member, or parent to show their chat here.</p>
              </div>
            )}
          </SegmentedTabPanelContent>
        </div>
      </div>
    </div>
  );
});
