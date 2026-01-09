'use client';

import { Suspense, useState } from 'react';
import { TasksBoard } from '@/features/tasks/components/TasksBoard';
import { TasksTable } from '@/features/tasks/components/TasksTable';
import { CreateTaskDialog } from '@/features/tasks/components/CreateTaskDialog';
import { TaskDetailModal } from '@/features/tasks/components/TaskDetailModal';
import { Button, Tabs, TabsList, TabsTrigger } from '@altitutor/ui';
import { Plus } from 'lucide-react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { TaskWithAssignee } from '@/features/tasks/types';

export default function TasksPage() {
  const search = useSearchParams();
  const router = useRouter();
  const viewParam = search.get('view') || 'kanban';
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState<'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done' | undefined>(undefined);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const setView = (v: 'kanban' | 'table') => {
    const params = new URLSearchParams(search.toString());
    params.set('view', v);
    router.push(`/tasks?${params.toString()}`);
  };

  const handleTaskClick = (task: TaskWithAssignee) => {
    setSelectedTaskId(task.id);
    setIsDetailModalOpen(true);
  };

  const handleTaskUpdated = () => {
    // Refetch will happen automatically via query invalidation
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
        <div className="flex items-center gap-4">
          <Tabs value={viewParam} onValueChange={(v) => setView(v as 'kanban' | 'table')}>
            <TabsList>
              <TabsTrigger value="kanban">Kanban</TabsTrigger>
              <TabsTrigger value="table">Table</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Task
          </Button>
        </div>
      </div>

      <Suspense>
        {viewParam === 'kanban' ? (
          <TasksBoard
            onCreateTask={(status) => {
              // Set default status and open create modal
              setDefaultStatus(status);
              setIsCreateModalOpen(true);
            }}
            onTaskClick={handleTaskClick}
          />
        ) : (
          <TasksTable onTaskClick={handleTaskClick} />
        )}
      </Suspense>

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

      {/* Task Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedTaskId(null);
          }}
          taskId={selectedTaskId}
          onTaskUpdated={handleTaskUpdated}
        />
      )}
    </div>
  );
}

