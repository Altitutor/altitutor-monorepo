'use client';

import { useState, useMemo } from 'react';
import { ScrollArea, Tabs, TabsList, TabsTrigger, TabsContent } from '@altitutor/ui';
import type { IssueWithTags, IssueTag } from '../../types';
import { MessageSquare, Tags } from 'lucide-react';
import { TabTriggerLabel } from '../tabs/TabTriggerLabel';
import { EntityTabContent } from '../tabs/EntityTabContent';

interface IssueContentPanelProps {
  issue: IssueWithTags;
  isOpen: boolean;
  onClose: () => void;
}

export function IssueContentPanel({ issue, isOpen, onClose }: IssueContentPanelProps) {
  const tabs = useMemo(() => {
    const items: { id: string, type: 'message' | 'student' | 'staff' | 'class' | 'session' | 'invoice', entityId: string }[] = [];
    
    // Group tags by unique entity
    issue.tags.forEach(tag => {
      if (tag.conversation_id) {
        items.push({ id: `msg-${tag.conversation_id}`, type: 'message', entityId: tag.conversation_id });
      }
      if (tag.student_id) {
        items.push({ id: `student-${tag.student_id}`, type: 'student', entityId: tag.student_id });
      }
      if (tag.staff_id) {
        items.push({ id: `staff-${tag.staff_id}`, type: 'staff', entityId: tag.staff_id });
      }
      if (tag.class_id) {
        items.push({ id: `class-${tag.class_id}`, type: 'class', entityId: tag.class_id });
      }
      if (tag.session_id) {
        items.push({ id: `session-${tag.session_id}`, type: 'session', entityId: tag.session_id });
      }
      if (tag.invoice_id) {
        items.push({ id: `invoice-${tag.invoice_id}`, type: 'invoice', entityId: tag.invoice_id });
      }
    });
    
    return items;
  }, [issue.tags]);

  const [activeTab, setActiveTab] = useState<string>(tabs[0]?.id || 'no-tags');

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground p-8 text-center bg-muted/5 h-full">
        <div>
          <Tags className="h-12 w-12 mx-auto mb-4 opacity-20" />
          <p>No entities tagged to this issue yet.</p>
          <p className="text-sm">Tag a student, staff, or conversation to see linked content.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-muted/5 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full min-h-0">
        <div className="flex-shrink-0 border-b bg-background overflow-x-auto no-scrollbar">
          <TabsList className="inline-flex h-12 w-auto items-center justify-start rounded-none bg-transparent p-0">
            {tabs.map((tab) => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent h-full"
              >
                <div className="flex items-center gap-2">
                  {tab.type === 'message' ? <MessageSquare className="h-4 w-4" /> : <Tags className="h-4 w-4" />}
                  <TabTriggerLabel type={tab.type} id={tab.entityId} />
                </div>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="flex-1 min-h-0 relative">
          {tabs.map((tab) => (
            <TabsContent 
              key={tab.id} 
              value={tab.id} 
              className="absolute inset-0 m-0 hidden data-[state=active]:block h-full overflow-hidden"
            >
              <EntityTabContent 
                type={tab.type} 
                id={tab.entityId} 
                isOpen={isOpen && activeTab === tab.id} 
                onClose={onClose}
              />
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  );
}
