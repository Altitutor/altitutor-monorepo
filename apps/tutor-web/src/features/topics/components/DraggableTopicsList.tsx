'use client';

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@altitutor/ui';
import { GripVertical } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { deriveTopicCode } from '../utils/codes';

export interface DraggableTopicsListProps {
  topics: Tables<'topics'>[];
  allTopics: Tables<'topics'>[]; // Needed for code derivation
  onReorder: (updates: Array<{ id: string; index: number }>) => void;
}

interface SortableItemProps {
  topic: Tables<'topics'>;
  code: string;
}

function SortableItem({ topic, code }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: topic.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-3 border rounded-lg bg-background"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </button>
      <div className="flex-1">
        <span className="text-sm font-medium">{code}</span>
        <span className="text-sm ml-2">{topic.name}</span>
      </div>
    </div>
  );
}

export function DraggableTopicsList({
  topics,
  allTopics,
  onReorder,
}: DraggableTopicsListProps) {
  const [items, setItems] = useState(topics);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);

        const newItems = arrayMove(items, oldIndex, newIndex);

        // Generate updates with new indices (1-based)
        const updates = newItems.map((item, idx) => ({
          id: item.id,
          index: idx + 1,
        }));

        // Call parent's onReorder
        onReorder(updates);

        return newItems;
      });
    }
  };

  // Derive codes for topics
  const topicsWithCodes = items.map((topic) => ({
    topic,
    code: deriveTopicCode(topic, allTopics),
  }));

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p className="text-sm">No topics to display</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {topicsWithCodes.map(({ topic, code }) => (
            <SortableItem key={topic.id} topic={topic} code={code} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

