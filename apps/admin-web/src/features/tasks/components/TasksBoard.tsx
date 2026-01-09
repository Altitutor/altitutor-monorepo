'use client';

import { useState, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { TaskCard } from './TaskCard';
import { useTasks } from '../api/queries';
import { useUpdateTask } from '../api/mutations';
import type { TaskStatus, TaskPriority, TaskWithAssignee } from '../types';
import { cn } from '@/shared/utils/index';
import { Skeleton } from '@altitutor/ui';

interface TasksBoardProps {
  filters?: {
    assignedTo?: string;
    priority?: number;
    search?: string;
  };
}

const STATUS_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'backlog', label: 'Backlog' },
  { status: 'todo', label: 'Todo' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'in_review', label: 'In Review' },
  { status: 'done', label: 'Done' },
];

interface ColumnProps {
  status: TaskStatus;
  label: string;
  tasks: TaskWithAssignee[];
  onTaskClick: (task: TaskWithAssignee) => void;
}

function Column({ status, label, tasks, onTaskClick }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      data-status={status}
      className={cn(
        'flex-1 min-w-[250px] bg-muted/30 rounded-lg p-4',
        'flex flex-col gap-3',
        isOver && 'ring-2 ring-primary ring-offset-2'
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">{label}</h3>
        <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
          {tasks.length}
        </span>
      </div>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col gap-2 min-h-[100px]">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No tasks
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function TasksBoard({ filters }: TasksBoardProps) {
  const { data: tasks = [], isLoading } = useTasks({
    assignedTo: filters?.assignedTo,
    priority: filters?.priority as TaskPriority | undefined,
    search: filters?.search,
  });
  const updateTask = useUpdateTask();
  const [activeTask, setActiveTask] = useState<TaskWithAssignee | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group tasks by status
  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, TaskWithAssignee[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      in_review: [],
      done: [],
    };

    tasks.forEach((task) => {
      if (task.status in grouped) {
        grouped[task.status as TaskStatus].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);

    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Update task status
    updateTask.mutate({
      id: taskId,
      updates: { status: newStatus },
    });
  };

  if (isLoading) {
    return (
      <div className="flex gap-4">
        {STATUS_COLUMNS.map((col) => (
          <div key={col.status} className="flex-1 min-w-[250px] bg-muted/30 rounded-lg p-4">
            <Skeleton className="h-6 w-24 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((column) => (
            <Column
              key={column.status}
              status={column.status}
              label={column.label}
              tasks={tasksByStatus[column.status]}
              onTaskClick={setSelectedTask}
            />
          ))}
        </div>
        <DragOverlay>
          {activeTask ? (
            <div style={{ opacity: 0.5 }}>
              <TaskCard task={activeTask} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task detail modal would go here - we'll create it later */}
      {selectedTask && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setSelectedTask(null)}
        >
          <div
            className="bg-background rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">{selectedTask.title}</h2>
            {selectedTask.description && (
              <p className="text-muted-foreground mb-4">{selectedTask.description}</p>
            )}
            <button
              onClick={() => setSelectedTask(null)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

