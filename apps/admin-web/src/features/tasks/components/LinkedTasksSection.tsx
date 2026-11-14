'use client';

import { useState } from 'react';
import { ToolbarViewProvider } from '@altitutor/ui';
import { TasksList } from './TasksList';

type LinkedTasksView = 'list' | 'board';

interface LinkedTasksSectionProps {
  issueId?: string;
  projectId?: string;
}

export function LinkedTasksSection({ issueId, projectId }: LinkedTasksSectionProps) {
  const [view, setView] = useState<LinkedTasksView>('list');

  return (
    <ToolbarViewProvider value={{ value: view, options: [{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }], onPresetApply: (settings) => {if(settings.layout === 'list' || settings.layout === 'board') setView(settings.layout);}, onChange: (next) => { if (next === 'list' || next === 'board') setView(next); } }}>
      <TasksList
        layout={view}
        issueId={issueId}
        projectId={projectId}
        showIssuePill={!issueId}
        showProjectPill={!projectId}
        showLinkPill={false}
        noPadding={false}
      />
    </ToolbarViewProvider>
  );
}
