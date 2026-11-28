import type { DragEvent } from 'react';

export const entityReferenceDragType = 'application/x-altitutor-entity-reference';

export type EntityReferenceDragData = { id: string; label: string; type: string };

export function entityReferenceDragProps(reference: EntityReferenceDragData) {
  return {
    draggable: true,
    onDragStart(event: DragEvent<HTMLElement>) {
      if (!(event.target instanceof Element) || event.target.closest('[draggable="true"]') !== event.currentTarget) return;

      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData(entityReferenceDragType, JSON.stringify(reference));
    },
  };
}

export function readEntityReferenceDrag(dataTransfer: DataTransfer): EntityReferenceDragData | null {
  try {
    const data: unknown = JSON.parse(dataTransfer.getData(entityReferenceDragType));
    if (
      !data || typeof data !== 'object'
      || !('id' in data) || typeof data.id !== 'string' || !data.id
      || !('type' in data) || typeof data.type !== 'string' || !data.type
      || !('label' in data) || typeof data.label !== 'string' || !data.label
    ) return null;
    return { id: data.id, type: data.type, label: data.label };
  } catch {
    return null;
  }
}
