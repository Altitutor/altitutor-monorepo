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
  { id: 'reconciliation', width: 'full' },
  { id: 'tasks', width: 'standard' },
  { id: 'issues', width: 'standard' },
  { id: 'projects', width: 'standard' },
];

export const DASHBOARD_WIDGET_IDS = ids;
