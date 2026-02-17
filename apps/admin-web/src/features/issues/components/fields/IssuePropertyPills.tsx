'use client';

import { UseFormReturn } from 'react-hook-form';
import { IssueStatusPill } from './IssueStatusPill';
import type { IssueStatus } from '../../types';

interface IssuePropertyPillsProps {
  form: UseFormReturn<any>;
}

export function IssuePropertyPills({
  form,
}: IssuePropertyPillsProps) {
  return (
    <div className="flex flex-wrap gap-2 pb-2">
      <IssueStatusPill form={form} />
    </div>
  );
}
