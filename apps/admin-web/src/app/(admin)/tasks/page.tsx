'use client';

import { Suspense, useState } from 'react';
import { TasksBoard } from '@/features/tasks/components/TasksBoard';
import { TasksList } from '@/features/tasks/components/TasksList';
import { CreateTaskDialog } from '@/features/tasks/components/CreateTaskDialog';
import { SegmentedControl } from '@altitutor/ui';
import { AdminPageActionButton } from '@/shared/components';
import { Plus } from 'lucide-react';
import { useAdminPageViewParam } from '@/shared/hooks/useAdminPageViewParam';

const TASK_VIEWS = ['kanban', 'list'] as const;

function TasksPageContent() {
  const [view, setView] = useAdminPageViewParam(TASK_VIEWS, 'kanban');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | undefined>(undefined);

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-64px)] overflow-hidden">
      <div className="flex items-center justify-between flex-shrink-0 px-6 py-4">
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-4">
          <SegmentedControl
            value={view}
            onValueChange={(v) => setView(v as (typeof TASK_VIEWS)[number])}
            options={[
              { value: 'kanban', label: 'Board' },
              { value: 'list', label: 'List' },
            ]}
          />
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="Create Task"
            onClick={() => setIsCreateModalOpen(true)}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {view === 'kanban' ? (
          <TasksBoard
            onCreateTask={(status) => {
              setDefaultStatus(status);
              setIsCreateModalOpen(true);
            }}
          />
        ) : (
          <TasksList />
        )}
      </div>

      <CreateTaskDialog
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setDefaultStatus(undefined);
        }}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={null}>
      <TasksPageContent />
    </Suspense>
  );
}
