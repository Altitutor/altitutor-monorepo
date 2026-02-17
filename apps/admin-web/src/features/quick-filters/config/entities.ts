export type FieldType = 'select' | 'date' | 'number' | 'text' | 'boolean';

export interface FilterField {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string | number; label: string }[];
  placeholder?: string;
  supportPlaceholders?: boolean;
}

export interface EntityConfig {
  id: string;
  label: string;
  fields: FilterField[];
}

export const SUPPORTED_ENTITIES: EntityConfig[] = [
  {
    id: 'tasks',
    label: 'Tasks',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'backlog', label: 'Backlog' },
          { value: 'todo', label: 'Todo' },
          { value: 'in_progress', label: 'In Progress' },
          { value: 'in_review', label: 'In Review' },
          { value: 'done', label: 'Done' },
        ],
      },
      {
        key: 'priority',
        label: 'Priority',
        type: 'select',
        options: [
          { value: 0, label: 'No priority' },
          { value: 1, label: 'Urgent' },
          { value: 2, label: 'High' },
          { value: 3, label: 'Medium' },
          { value: 4, label: 'Low' },
        ],
      },
      {
        key: 'assignee',
        label: 'Assignee',
        type: 'select',
        supportPlaceholders: true,
      },
      {
        key: 'estimate',
        label: 'Estimate',
        type: 'select',
        options: [
          { value: 1, label: '1 (XS)' },
          { value: 2, label: '2 (S)' },
          { value: 3, label: '3 (M)' },
          { value: 5, label: '5 (L)' },
          { value: 8, label: '8 (XL)' },
        ],
      },
    ],
  },
  {
    id: 'students',
    label: 'Students',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'TRIAL', label: 'Trial' },
          { value: 'INACTIVE', label: 'Inactive' },
          { value: 'DISCONTINUED', label: 'Discontinued' },
        ],
      },
      {
        key: 'curriculum',
        label: 'Curriculum',
        type: 'select',
        options: [
          { value: 'SACE', label: 'SACE' },
          { value: 'IB', label: 'IB' },
          { value: 'PRESACE', label: 'Pre-SACE' },
          { value: 'PRIMARY', label: 'Primary' },
          { value: 'MEDICINE', label: 'Medicine' },
        ],
      },
      {
        key: 'year_level',
        label: 'Year Level',
        type: 'select',
        options: Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `Year ${i + 1}` })),
      },
    ],
  },
  {
    id: 'staff',
    label: 'Staff',
    fields: [
      {
        key: 'role',
        label: 'Role',
        type: 'select',
        options: [
          { value: 'ADMINSTAFF', label: 'Admin Staff' },
          { value: 'TUTOR', label: 'Tutor' },
        ],
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
    ],
  },
  {
    id: 'classes',
    label: 'Classes',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'Active' },
          { value: 'INACTIVE', label: 'Inactive' },
        ],
      },
      {
        key: 'day_of_week',
        label: 'Day of Week',
        type: 'select',
        options: [
          { value: 1, label: 'Monday' },
          { value: 2, label: 'Tuesday' },
          { value: 3, label: 'Wednesday' },
          { value: 4, label: 'Thursday' },
          { value: 5, label: 'Friday' },
          { value: 6, label: 'Saturday' },
          { value: 0, label: 'Sunday' },
        ],
      },
    ],
  },
  {
    id: 'sessions',
    label: 'Sessions',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'SCHEDULED', label: 'Scheduled' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
          { value: 'RESCHEDULED', label: 'Rescheduled' },
        ],
      },
      {
        key: 'type',
        label: 'Type',
        type: 'select',
        options: [
          { value: 'REGULAR', label: 'Regular' },
          { value: 'TRIAL', label: 'Trial' },
          { value: 'DRAFTING', label: 'Drafting' },
          { value: 'AD_HOC', label: 'Ad-hoc' },
        ],
      },
      {
        key: 'scheduled_at',
        label: 'Date',
        type: 'date',
        supportPlaceholders: true,
      },
      {
        key: 'staff_id',
        label: 'Staff',
        type: 'select',
        supportPlaceholders: true,
      },
    ],
  },
  {
    id: 'admin_shifts',
    label: 'Admin Shifts',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'SCHEDULED', label: 'Scheduled' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ],
      },
      {
        key: 'start_time',
        label: 'Date',
        type: 'date',
        supportPlaceholders: true,
      },
    ],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'DRAFT', label: 'Draft' },
          { value: 'OPEN', label: 'Open' },
          { value: 'PAID', label: 'Paid' },
          { value: 'VOID', label: 'Void' },
          { value: 'UNCOLLECTIBLE', label: 'Uncollectible' },
        ],
      },
      {
        key: 'created_at',
        label: 'Date',
        type: 'date',
        supportPlaceholders: true,
      },
    ],
  },
  {
    id: 'tutor_logs',
    label: 'Tutor Logs',
    fields: [
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        options: [
          { value: 'DRAFT', label: 'Draft' },
          { value: 'SUBMITTED', label: 'Submitted' },
          { value: 'APPROVED', label: 'Approved' },
          { value: 'REJECTED', label: 'Rejected' },
        ],
      },
      {
        key: 'date',
        label: 'Date',
        type: 'date',
        supportPlaceholders: true,
      },
    ],
  },
  {
    id: 'subjects',
    label: 'Subjects',
    fields: [
      {
        key: 'curriculum',
        label: 'Curriculum',
        type: 'select',
        options: [
          { value: 'SACE', label: 'SACE' },
          { value: 'IB', label: 'IB' },
          { value: 'PRESACE', label: 'Pre-SACE' },
          { value: 'PRIMARY', label: 'Primary' },
          { value: 'MEDICINE', label: 'Medicine' },
        ],
      },
    ],
  },
  {
    id: 'topics',
    label: 'Topics',
    fields: [
      {
        key: 'level',
        label: 'Level',
        type: 'select',
        options: [
          { value: 'BASIC', label: 'Basic' },
          { value: 'INTERMEDIATE', label: 'Intermediate' },
          { value: 'ADVANCED', label: 'Advanced' },
        ],
      },
    ],
  },
];
