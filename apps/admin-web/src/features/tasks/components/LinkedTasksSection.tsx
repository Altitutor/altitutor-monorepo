'use client';

import { useState } from 'react';
import { SegmentedControl } from '@altitutor/ui';
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
    <div className="space-y-4 min-w-0 max-w-full">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Linked Tasks</h3>
        <SegmentedControl
          value={view}
          onValueChange={(value) => setView(value as LinkedTasksView)}
          options={[
            { value: 'list', label: 'List' },
            { value: 'board', label: 'Board' },
          ]}
        />
      </div>

      {view === 'list' ? (
        <div className="border-y bg-background overflow-hidden w-full min-w-0 max-w-full">
          <TasksList
            issueId={issueId}
            projectId={projectId}
            compact
            hideToolbar
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
  );
}
