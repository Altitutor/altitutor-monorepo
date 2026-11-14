import { encodeViewConfig, type DisplaySettings, type QuickFilter } from '@altitutor/shared';

function view<const Slug extends string>(entity: string, slug: Slug, name: string, settings: DisplaySettings) {
  return { entity, slug, name, settings };
}

const sessionColumns = ['date', 'time', 'class', 'staff', 'students', 'tutor_log'];
const invoiceColumns = ['invoice_number', 'date', 'student', 'items', 'amount', 'status', 'actions'];
const sessionQueue = <const Slug extends string>(slug: Slug, name: string) => view('sessions', slug, name, {
  layout: 'table', filters: { reconciliation: [slug] }, sortBy: 'start_at',
  sortDirection: 'desc', groupBy: null, visibleColumns: sessionColumns,
});

export const operationalViews = {
  billingAdjustments: view('billing-adjustments', 'billing-adjustments', 'Billing adjustments', { filters: {}, sortBy: 'date', sortDirection: 'asc', groupBy: null, visibleColumns: ['student', 'session', 'date', 'amount', 'issue'] }),
  uninvoiced: view('billing-charges', 'uninvoiced', 'To invoice', { filters: {}, sortBy: 'date', sortDirection: 'asc', groupBy: null, visibleColumns: ['student', 'session', 'date', 'amount', 'issue'] }),
  voidInvoices: view('billing-charges', 'void-invoices', 'Previously voided', { filters: { reason: ['voided'] }, sortBy: 'date', sortDirection: 'asc', groupBy: null, visibleColumns: ['student', 'session', 'date', 'amount', 'issue'] }),
  unpaid: view('invoices', 'unpaid', 'Unpaid invoices', {
    filters: { payment: ['unpaid'] }, sortBy: 'invoice_date', sortDirection: 'desc',
    groupBy: null, visibleColumns: invoiceColumns,
  }),
  voidedInvoices: view('invoices', 'voided', 'Voided invoices', {
    filters: { status: ['void'] }, sortBy: 'invoice_date', sortDirection: 'desc',
    groupBy: null, visibleColumns: invoiceColumns,
  }),
  noPayment: view('students', 'no-payment-method', 'Students without a payment method', {
    layout: 'list', filters: { reconciliation: ['no-payment-method'] }, sortBy: 'last_name',
    sortDirection: 'asc', groupBy: null, visibleColumns: ['student', 'status', 'payment_method'],
  }),
  unlogged: sessionQueue('unlogged', 'Unlogged sessions'),
  noStaff: view('classes', 'no-staff', 'Classes without staff', {
    layout: 'table', filters: { staffing: ['unassigned'] }, sortBy: 'day_of_week',
    sortDirection: 'asc', groupBy: null, visibleColumns: ['day', 'time', 'subject', 'students', 'staff'],
  }),
  noClasses: view('students', 'no-classes', 'Students without classes', {
    layout: 'list', filters: { reconciliation: ['no-classes'] }, sortBy: 'last_name',
    sortDirection: 'asc', groupBy: null, visibleColumns: ['student', 'classes'],
  }),
  unassignedTasks: view('tasks', 'unassigned', 'Unassigned tasks', {
    layout: 'list', filters: { assignee: ['__null__'], status: ['backlog', 'todo', 'in_progress', 'in_review'] },
    sortBy: 'priority', sortDirection: 'asc', groupBy: 'status',
    visibleColumns: ['assignee', 'due_date', 'priority', 'issue', 'project'],
  }),
  noLead: view('projects', 'no-lead', 'Projects without a lead', {
    layout: 'list', filters: { lead: ['unassigned'] }, sortBy: 'priority',
    sortDirection: 'asc', groupBy: 'status', visibleColumns: ['project_lead', 'target_date', 'priority'],
  }),
  subsidies: view('students', 'subsidies', 'Subsidies', {
    layout: 'list', filters: { status: ['ACTIVE'], subsidy: ['current'] }, sortBy: 'last_name',
    sortDirection: 'asc', groupBy: null, visibleColumns: ['student', 'status', 'subsidies'],
  }),
  tutorLogs: view('sessions', 'tutor-logs', 'Tutor logs', {
    layout: 'table', filters: { tutor_log: ['logged'] }, sortBy: 'start_at',
    sortDirection: 'desc', groupBy: null, visibleColumns: ['date', 'time', 'class', 'staff', 'students', 'topics'],
  }),
  adminMeetings: view('sessions', 'admin-meetings', 'Admin meetings', {
    layout: 'table', filters: { type: ['ADMIN_MEETING'] }, sortBy: 'start_at',
    sortDirection: 'desc', groupBy: null, visibleColumns: ['date', 'time', 'class', 'staff', 'tutor_log'],
  }),
  payTiers: view('staff', 'pay-tiers', 'Pay tiers', {
    filters: { status: ['ACTIVE', 'TRIAL'], role: ['TUTOR', 'ADMINSTAFF'] }, sortBy: 'last_name',
    sortDirection: 'asc', groupBy: null, visibleColumns: ['staff', 'role', 'tier', 'tier_status', 'last_check_in'],
  }),
};

export function operationalViewFilters(entity: string): QuickFilter[] {
  return Object.values(operationalViews).filter((entry) => entry.entity === entity).map((entry) => ({
    id: `builtin:${entity}:${entry.slug}`,
    target_entity: entity,
    name: entry.name,
    user_id: null,
    created_at: '',
    updated_at: '',
    config: encodeViewConfig(entry.settings),
  }));
}

export function operationalViewHref(entry: ReturnType<typeof view>) {
  const { filters, layout, sortBy, sortDirection, groupBy, visibleColumns } = entry.settings;
  const params = new URLSearchParams({ sort: sortBy ?? '__none__', order: sortDirection, columns: visibleColumns.join(',') });
  if (layout) params.set('view', layout);
  if (groupBy) params.set('group', groupBy);
  for (const [key, values] of Object.entries(filters)) {
    if (values.length) params.set(key, values.map(String).join(','));
  }
  const path = entry.entity === 'billing-charges' ? '/billing/to-invoice' : entry.entity === 'billing-adjustments' ? '/billing/adjustments' : entry.entity === 'invoices' ? '/billing/invoices' : `/${entry.entity}`;
  return `${path}?${params.toString()}`;
}

export const reconciliationViewGroups = [
  { key: 'financial', label: 'Financial', views: [operationalViews.billingAdjustments, operationalViews.uninvoiced, operationalViews.unpaid, operationalViews.noPayment] },
  { key: 'scheduling', label: 'Scheduling', views: [operationalViews.unlogged, operationalViews.noStaff, operationalViews.noClasses] },
  { key: 'operations', label: 'Operations', views: [operationalViews.unassignedTasks, operationalViews.noLead] },
] as const;

type ReconciliationView = (typeof reconciliationViewGroups)[number]['views'][number];
export type ReconciliationViewKey = ReconciliationView['slug'] | typeof operationalViews.voidInvoices.slug;

export const reconciliationViews: ReconciliationView[] = reconciliationViewGroups.flatMap(({ views }) => [...views]);
export function reconciliationViewKey(viewId: string): ReconciliationViewKey | undefined {
  return [...reconciliationViews, operationalViews.voidInvoices].find(({ entity, slug }) => viewId === `builtin:${entity}:${slug}`)?.slug;
}
