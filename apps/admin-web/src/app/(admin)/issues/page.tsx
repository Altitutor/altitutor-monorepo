'use client';

import { Suspense, useState } from 'react';
import { SegmentedControl } from '@altitutor/ui';
import { AdminPageActionButton } from '@/shared/components';
import { Plus } from 'lucide-react';
import { IssuesBoard } from '@/features/issues/components/IssuesBoard';
import { IssuesList } from '@/features/issues/components/IssuesList';
import { CreateIssueDialog } from '@/features/issues/components/CreateIssueDialog';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';

const ISSUE_VIEWS = ['kanban', 'list'] as const;

function IssuesPageContent() {
  const [view, setView] = useAdminPageViewParam(ISSUE_VIEWS, 'kanban');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-64px)] overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 px-6 py-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
        </div>
        <div className="flex items-center gap-4">
          <SegmentedControl
            value={view}
            onValueChange={(v) => setView(v as (typeof ISSUE_VIEWS)[number])}
            options={[
              { value: 'kanban', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="New Issue"
            onClick={() => setIsCreateDialogOpen(true)}
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {view === 'kanban' ? <IssuesBoard /> : <IssuesList />}
      </div>

      <CreateIssueDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={null}>
      <IssuesPageContent />
    </Suspense>
  );
}
