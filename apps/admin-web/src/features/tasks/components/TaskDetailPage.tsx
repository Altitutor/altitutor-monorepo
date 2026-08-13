'use client';

import { useRouter } from 'next/navigation';
import { TaskDetailView } from './TaskDetailView';

interface TaskDetailPageProps {
  taskId: string;
}

export function TaskDetailPage({ taskId }: TaskDetailPageProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col h-[calc(100dvh-var(--navbar-height)-64px)] overflow-hidden">
      <TaskDetailView
        taskId={taskId}
        enabled
        variant="page"
        onClose={() => router.push('/tasks')}
      />
    </div>
  );
}
