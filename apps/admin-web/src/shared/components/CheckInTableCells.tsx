import { TableCell, TableHead } from '@altitutor/ui';
import { formatCheckInRecency } from '@/features/reconciliation/utils/formatCheckInRecency';

export const checkInColumns = [
  { key: 'last_check_in', label: 'Last check-in' },
  { key: 'time_since_last_check_in', label: 'Time since last check-in' },
];

export function CheckInTableHeads({ columns }: { columns: string[] }) {
  return <>{checkInColumns.filter(({ key }) => columns.includes(key)).map(({ key, label }) => <TableHead key={key}>{label}</TableHead>)}</>;
}

export function CheckInTableCells({ columns, date, error }: { columns: string[]; date?: string; error?: boolean }) {
  return <>
    {columns.includes('last_check_in') && <TableCell className="whitespace-nowrap">{error ? 'Unavailable' : date ? new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'Australia/Adelaide' }).format(new Date(date)) : '—'}</TableCell>}
    {columns.includes('time_since_last_check_in') && <TableCell className="whitespace-nowrap">{error ? 'Unavailable' : formatCheckInRecency(date ?? null)}</TableCell>}
  </>;
}
