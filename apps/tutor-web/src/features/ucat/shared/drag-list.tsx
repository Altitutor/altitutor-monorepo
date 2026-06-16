'use client'

import { DndContext, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Minus, Pencil } from 'lucide-react'
import { Button } from '@altitutor/ui'
import { cn } from '@/shared/utils'
import { tutorBtnIconOutline, tutorCardCn } from '@/shared/lib/tutor-visual'

/** Reorders visible ids after drag while preserving hidden ids in the full list. */
export function mergeVisibleOrderIntoFull(
  fullIds: string[],
  previousVisibleIds: string[],
  nextVisibleIds: string[],
): string[] {
  const visibleSet = new Set(previousVisibleIds)
  const result: string[] = []
  let visibleIndex = 0

  for (const id of fullIds) {
    if (visibleSet.has(id)) {
      result.push(nextVisibleIds[visibleIndex] ?? id)
      visibleIndex += 1
    } else {
      result.push(id)
    }
  }

  return result
}

export function UcatSortableList({
  ids,
  renderLabel,
  onChange,
  onRemove,
  onEdit,
  disableReorder = false,
}: {
  ids: string[]
  renderLabel: (id: string, index: number) => React.ReactNode
  onChange: (ids: string[]) => void
  onRemove: (id: string) => void
  onEdit?: (id: string) => void
  disableReorder?: boolean
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  if (disableReorder) {
    return (
      <div className="space-y-2">
        {ids.map((id, index) => (
          <ListRow
            key={id}
            label={renderLabel(id, index)}
            onRemove={() => onRemove(id)}
            onEdit={onEdit ? () => onEdit(id) : undefined}
            showDragHandle={false}
          />
        ))}
      </div>
    )
  }

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
            <SortableRow
              key={id}
              id={id}
              label={renderLabel(id, index)}
              onRemove={() => onRemove(id)}
              onEdit={onEdit ? () => onEdit(id) : undefined}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function ListRow({
  label,
  onRemove,
  onEdit,
  removeButtonVariant = 'outline',
  showDragHandle,
  dragHandleProps,
  isDragging = false,
  setNodeRef,
  style,
}: {
  label: React.ReactNode
  onRemove: () => void
  onEdit?: () => void
  removeButtonVariant?: 'outline' | 'destructive'
  showDragHandle: boolean
  dragHandleProps?: {
    attributes: React.HTMLAttributes<HTMLElement>
    listeners: React.HTMLAttributes<HTMLElement> | undefined
  }
  isDragging?: boolean
  setNodeRef?: (node: HTMLElement | null) => void
  style?: React.CSSProperties
}) {
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(tutorCardCn('p-3'), isDragging && 'opacity-60')}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {showDragHandle ? (
            <button
              type="button"
              className="cursor-grab text-muted-foreground"
              {...dragHandleProps?.attributes}
              {...dragHandleProps?.listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : (
            <span className="w-4 shrink-0" aria-hidden />
          )}
          <div className="text-sm">{label}</div>
        </div>
        <div className="flex items-center gap-1">
          {onEdit ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className={cn(tutorBtnIconOutline, 'text-muted-foreground hover:text-foreground')}
              onClick={onEdit}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            type="button"
            variant={removeButtonVariant === 'destructive' ? 'destructive' : 'outline'}
            size="icon"
            className={
              removeButtonVariant === 'outline'
                ? cn(
                    tutorBtnIconOutline,
                    '!text-destructive ring-destructive/35 hover:!text-destructive hover:bg-destructive/10',
                  )
                : undefined
            }
            onClick={onRemove}
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function SortableRow({
  id,
  label,
  onRemove,
  onEdit,
  removeButtonVariant = 'outline',
}: {
  id: string
  label: React.ReactNode
  onRemove: () => void
  onEdit?: () => void
  removeButtonVariant?: 'outline' | 'destructive'
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <ListRow
      label={label}
      onRemove={onRemove}
      onEdit={onEdit}
      removeButtonVariant={removeButtonVariant}
      showDragHandle
      dragHandleProps={{ attributes, listeners }}
      isDragging={isDragging}
      setNodeRef={setNodeRef}
      style={style}
    />
  )
}
