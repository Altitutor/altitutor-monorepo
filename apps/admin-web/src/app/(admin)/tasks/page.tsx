'use client';

import { Suspense, useState } from 'react';
import { TasksBoard } from '@/features/tasks/components/TasksBoard';
import { TasksList } from '@/features/tasks/components/TasksList';
import { CreateTaskDialog } from '@/features/tasks/components/CreateTaskDialog';
import { Button, Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';

export default function TasksPage() {
  const search = useSearchParams();
  const router = useRouter();
  const viewParam = (search.get('view') || 'kanban') as 'kanban' | 'list';
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | undefined>(undefined);

  const setView = (v: 'kanban' | 'list') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/tasks?${params.toString()}`);
  };

  const handleTaskUpdated = () => {
    // Refetch will happen automatically via query invalidation
  };

  return (
    <div className="max-h-[calc(100vh-var(--navbar-height)-4rem)] flex flex-col p-6 overflow-hidden" style={{ height: 'calc(100vh - var(--navbar-height) - 4rem)' }}>
      <div className="flex items-center justify-between flex-shrink-0 mb-4">
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-4">
          <Tabs value={viewParam} onValueChange={(v) => setView(v as 'kanban' | 'list')}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <Suspense>
          {viewParam === 'kanban' ? (
            <TasksBoard
              onCreateTask={(status) => {
                setDefaultStatus(status);
                setIsCreateModalOpen(true);
              }}
            />
          ) : (
            <TasksList />
          )}
        </Suspense>
      </div>

      {/* Create Task Modal */}
      <CreateTaskDialog
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setDefaultStatus(undefined);
        }}
        onTaskCreated={handleTaskUpdated}
        defaultStatus={defaultStatus}
      />
    </div>
  );
}

