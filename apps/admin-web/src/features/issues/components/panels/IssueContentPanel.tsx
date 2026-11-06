'use client';

import { memo, type ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import type { IssueFormData, IssueTag } from '../../types';
import { IssuePriorityField } from '../fields/IssuePriorityField';
import { IssueStatusField } from '../fields/IssueStatusField';
import { IssueDueDateField } from '../fields/IssueDueDateField';
import { EntitySidebarCard, EntitySidebarCards } from '@/shared/components/EntitySidebarCard';

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
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

export const IssueContentPanel = memo(function IssueContentPanel({ form }: IssueContentPanelProps) {
  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <EntitySidebarCards defaultOpen={['properties']}>
        <EntitySidebarCard value="properties" title="Properties">
          <div className="space-y-4">
            <PropertyRow label="Status">
              <IssueStatusField form={form} />
            </PropertyRow>
            <PropertyRow label="Priority">
              <IssuePriorityField form={form} />
            </PropertyRow>
            <PropertyRow label="Due date">
              <IssueDueDateField form={form} />
            </PropertyRow>
          </div>
        </EntitySidebarCard>
      </EntitySidebarCards>
    </div>
  );
});
