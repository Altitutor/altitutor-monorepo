'use client';

import { TaskDetailPage } from '@/features/tasks/components/TaskDetailPage';

export default function TaskDetailRoute({ params }: { params: { id: string } }) {
  return <TaskDetailPage taskId={params.id} />;
}
