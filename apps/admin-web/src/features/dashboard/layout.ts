import { z } from 'zod';

export const DASHBOARD_WIDGETS = {
  sessions: 'Sessions today',
  updates: 'Updates today',
  reconciliation: 'Reconciliation',
  reports: 'Reports',
  tasks: 'Tasks',
  issues: 'Issues',
  projects: 'Projects',
} as const;

const ids = ['sessions', 'updates', 'reconciliation', 'reports', 'tasks', 'issues', 'projects'] as const satisfies readonly (keyof typeof DASHBOARD_WIDGETS)[];
export const dashboardLayoutSchema = z.array(z.object({
  id: z.enum(ids),
  width: z.enum(['standard', 'wide', 'full']),
}).strict()).max(ids.length).refine(
  (widgets) => new Set(widgets.map(({ id }) => id)).size === widgets.length,
  'Each widget can appear only once.',
);

export type DashboardWidget = z.infer<typeof dashboardLayoutSchema>[number];
export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidget[] = [
  { id: 'sessions', width: 'wide' },
  { id: 'updates', width: 'standard' },
  { id: 'reconciliation', width: 'standard' },
  { id: 'tasks', width: 'standard' },
  { id: 'issues', width: 'standard' },
  { id: 'projects', width: 'standard' },
];

export const DASHBOARD_WIDGET_IDS = ids;

/** Adopt new defaults for layouts previously saved with the original default. */
export function upgradeDashboardLayout(layout: DashboardWidget[]): DashboardWidget[] {
  const matchesOldDefault = layout.length === DEFAULT_DASHBOARD_LAYOUT.length
    && layout.every(({ id, width }, index) => {
      const entry = DEFAULT_DASHBOARD_LAYOUT[index];
      return id === entry.id && width === (id === 'reconciliation' ? 'full' : entry.width);
    });
  return matchesOldDefault ? DEFAULT_DASHBOARD_LAYOUT : layout;
}
