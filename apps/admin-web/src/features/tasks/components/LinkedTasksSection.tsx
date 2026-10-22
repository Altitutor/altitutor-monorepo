'use client';

import { useState } from 'react';
import { ToolbarViewProvider } from '@altitutor/ui';
import { TasksBoard } from './TasksBoard';
import { TasksList } from './TasksList';

type LinkedTasksView = 'list' | 'board';

interface LinkedTasksSectionProps {
  issueId?: string;
  projectId?: string;
}

export function LinkedTasksSection({ issueId, projectId }: LinkedTasksSectionProps) {
  const [view, setView] = useState<LinkedTasksView>('list');

  return (
    <ToolbarViewProvider value={{ value: view, options: [{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }], onChange: (next) => { if (next === 'list' || next === 'board') setView(next); } }}>
    <div className="space-y-4 min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Linked Tasks</h3>

      </div>

      {view === 'list' ? (
        <div className="border-y bg-background overflow-hidden w-full min-w-0 max-w-full">
          <TasksList
            issueId={issueId}
            projectId={projectId}
            compact
            showIssuePill={!issueId}
            showProjectPill={!projectId}
            showLinkPill={false}
            noPadding
          />
        </div>
      ) : (
        <div className="h-[32rem] min-h-0 overflow-hidden rounded-md border bg-background">
          <TasksBoard issueId={issueId} projectId={projectId} showLinkPill={false} />
        </div>
      )}
    </div>
    </ToolbarViewProvider>
  );
}
