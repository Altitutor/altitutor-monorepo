"use client";

import { useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Checkbox } from '@altitutor/ui';
import { GripVertical } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components/dialog-shell';
import { defaultSidebarPreferences, orderSidebarEntries, setSidebarVisibility, sidebarEntries, type SidebarPreferences } from './preferences';

type SidebarEntry = typeof sidebarEntries[number];

function EntryRow({ entry, hidden, saving, onToggle }: {
  entry: SidebarEntry;
  hidden: boolean;
  saving: boolean;
  onToggle: (id: string, visible: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition } = useSortable({
    id: entry.id,
    disabled: saving,
  });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className="flex items-center gap-2 rounded-md bg-card px-1 py-1">
      <Button ref={setActivatorNodeRef} type="button" variant="ghost" size="icon" className="size-8 touch-none cursor-grab"
        disabled={saving} {...attributes} {...listeners} aria-label={`Reorder ${entry.title}`}>
        <GripVertical className="size-4" aria-hidden />
      </Button>
      <label className="flex flex-1 items-center gap-2 text-sm">
        <Checkbox checked={!hidden} disabled={saving} onCheckedChange={(checked) => onToggle(entry.id, checked === true)} />
        {entry.title}
      </label>
    </li>
  );
}

export function SidebarPreferencesDialog({ preferences, saving, onSave, onClose }: {
  preferences: SidebarPreferences;
  saving: boolean;
  onSave: (preferences: SidebarPreferences) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(preferences);
  const [error, setError] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const roots = sidebarEntries.filter((entry) => entry.parent === null);
  const groups = [{ label: 'Main navigation', entries: roots }, ...roots.flatMap((root) => {
    const entries = sidebarEntries.filter((entry) => entry.parent === root.id);
    return entries.length ? [{ label: root.title, entries }] : [];
  })];

  async function save() {
    setError(null);
    try {
      await onSave(draft);
      onClose();
    } catch {
      setError('Could not save sidebar preferences.');
    }
  }

  return (
    <AdminDialogShell
      open title="Customise sidebar" subtitle="Drag pages to reorder them, and choose which ones appear." onClose={onClose} closeDisabled={saving}
      bodyClassName="max-h-[65vh] overflow-y-auto"
      footer={<div className="flex w-full justify-between gap-2">
        <Button type="button" variant="ghost" disabled={saving} onClick={() => setDraft(defaultSidebarPreferences)}>Reset to default</Button>
        <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save sidebar'}</Button>
      </div>}
    >
      {groups.map(({ label, entries }) => {
        const ordered = orderSidebarEntries(entries, draft.order, (entry) => entry.id);
        const ids = ordered.map((entry) => entry.id);
        return (
          <section key={label} className="mb-4 last:mb-0">
            <h3 className="px-2 text-sm font-medium text-muted-foreground">{label}</h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return;
              const from = ids.findIndex((id) => id === active.id);
              const to = ids.findIndex((id) => id === over.id);
              if (from < 0 || to < 0) return;
              setDraft((current) => ({ ...current, order: [...current.order.filter((id) => !ids.includes(id)), ...arrayMove(ids, from, to)] }));
            }}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ul className="divide-y">
                  {ordered.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} hidden={draft.hidden.includes(entry.id)} saving={saving}
                      onToggle={(id, visible) => setDraft((current) => setSidebarVisibility(current, id, visible))} />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        );
      })}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </AdminDialogShell>
  );
}
