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
import { EditTaskDialog } from './EditTaskDialog';
import { useTasks } from '../api/queries';
import { useUpdateTask } from '../api/mutations';
import type { TaskStatus, TaskPriority, TaskWithAssignee } from '../types';
import { cn } from '@/shared/utils/index';
import { Skeleton, Button } from '@altitutor/ui';
import { Plus } from 'lucide-react';

interface TasksBoardProps {
  filters?: {
    assignedTo?: string;
    priority?: number;
    search?: string;
  };
  onCreateTask?: (status: TaskStatus) => void;
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
  onCreateTask?: (status: TaskStatus) => void;
}

function Column({ status, label, tasks, onTaskClick, onCreateTask }: ColumnProps) {
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-background px-2 py-1 rounded">
            {tasks.length}
          </span>
          {onCreateTask && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onCreateTask(status);
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
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

export function TasksBoard({ filters, onCreateTask }: TasksBoardProps) {
  const { data: tasks = [], isLoading } = useTasks({
    assignedTo: filters?.assignedTo,
    priority: filters?.priority as TaskPriority | undefined,
    search: filters?.search,
  });
  const updateTask = useUpdateTask();
  const [activeTask, setActiveTask] = useState<TaskWithAssignee | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

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
    
    // Determine the target status
    // If over.id is a valid status, use it directly (dropped on column)
    // Otherwise, it's a task ID (dropped on a task card), so find that task's status
    const validStatuses = STATUS_COLUMNS.map((col) => col.status);
    let newStatus: TaskStatus;
    
    if (validStatuses.includes(over.id as TaskStatus)) {
      newStatus = over.id as TaskStatus;
    } else {
      // over.id is a task ID, find that task's status
      const targetTask = tasks.find((t) => t.id === over.id);
      if (!targetTask) return;
      newStatus = targetTask.status as TaskStatus;
    }

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
              onTaskClick={(task) => {
                setSelectedTaskId(task.id);
                setIsEditDialogOpen(true);
              }}
              onCreateTask={onCreateTask}
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

      {/* Edit task dialog */}
      {selectedTaskId && (
        <EditTaskDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedTaskId(null);
          }}
          taskId={selectedTaskId}
        />
      )}
    </>
  );
}

