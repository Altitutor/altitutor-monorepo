'use client';

import { Button, Checkbox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { AdminDialogShell } from '@/shared/components/dialog-shell';
import { DASHBOARD_WIDGETS, DASHBOARD_WIDGET_IDS, DEFAULT_DASHBOARD_LAYOUT, type DashboardWidget } from './layout';

type Props = {
  layout: DashboardWidget[];
  onChange: (layout: DashboardWidget[]) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  error: string | null;
};

export function DashboardLayoutDialog({ layout, onChange, onClose, onSave, saving, error }: Props) {
  const move = (index: number, delta: number) => {
    const next = [...layout];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };

  return (
    <AdminDialogShell
      open
      onClose={onClose}
      closeDisabled={saving}
      title="Customize dashboard"
      subtitle="Choose which widgets appear, their order, and how much space they use."
      footer={<div className="flex w-full flex-wrap justify-between gap-2">
        <Button variant="ghost" disabled={saving} onClick={() => onChange(DEFAULT_DASHBOARD_LAYOUT)}>Reset to default</Button>
        <Button disabled={saving} onClick={onSave}>{saving ? 'Saving…' : 'Save layout'}</Button>
      </div>}
    >
      <ul className="divide-y">
        {layout.map(({ id, width }, index) => (
          <li key={id} className="flex flex-wrap items-center gap-2 py-2">
            <label className="flex flex-1 items-center gap-2 text-sm">
              <Checkbox checked disabled={saving} onCheckedChange={() => onChange(layout.filter((item) => item.id !== id))} />
              {DASHBOARD_WIDGETS[id]}
            </label>
            <Select value={width} disabled={saving} onValueChange={(value: DashboardWidget['width']) => onChange(
              layout.map((item) => item.id === id ? { ...item, width: value } : item),
            )}>
              <SelectTrigger className="w-28" aria-label={`${DASHBOARD_WIDGETS[id]} width`}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
                <SelectItem value="full">Full width</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" disabled={saving || index === 0} aria-label={`Move ${DASHBOARD_WIDGETS[id]} up`} onClick={() => move(index, -1)}><ArrowUp /></Button>
            <Button variant="ghost" size="icon" disabled={saving || index === layout.length - 1} aria-label={`Move ${DASHBOARD_WIDGETS[id]} down`} onClick={() => move(index, 1)}><ArrowDown /></Button>
          </li>
        ))}
        {DASHBOARD_WIDGET_IDS.filter((id) => !layout.some((item) => item.id === id)).map((id) => (
          <li key={id} className="py-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={false} disabled={saving} onCheckedChange={() => onChange([...layout, { id, width: 'standard' }])} />
              {DASHBOARD_WIDGETS[id]}
            </label>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
    </AdminDialogShell>
  );
}
