'use client'

import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Trash2 } from 'lucide-react'
import { Button } from '@altitutor/ui'

export function UcatSortableList({
  ids,
  renderLabel,
  onChange,
  onRemove,
}: {
  ids: string[]
  renderLabel: (id: string, index: number) => React.ReactNode
  onChange: (ids: string[]) => void
  onRemove: (id: string) => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = ids.indexOf(String(active.id))
        const newIndex = ids.indexOf(String(over.id))
        if (oldIndex < 0 || newIndex < 0) return
        onChange(arrayMove(ids, oldIndex, newIndex))
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {ids.map((id, index) => (
            <SortableRow key={id} id={id} label={renderLabel(id, index)} onRemove={() => onRemove(id)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({ id, label, onRemove }: { id: string; label: React.ReactNode; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded border p-3 ${isDragging ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className="cursor-grab text-muted-foreground" {...attributes} {...listeners}>
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="text-sm">{label}</div>
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
