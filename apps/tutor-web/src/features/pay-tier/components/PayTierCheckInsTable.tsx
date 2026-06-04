'use client';

import { format } from 'date-fns';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Eye } from 'lucide-react';
import type { PayTierCheckIn, PayTierCheckInStaffMember } from '@altitutor/shared/pay-tiers';
import {
  tutorBtnPrimary,
  tutorTableBodyRow,
  tutorTableHeaderRow,
  tutorTableShell,
} from '@/shared/lib/tutor-visual';

type PayTierCheckInsTableProps = {
  checkIns: PayTierCheckIn[];
  onOpenSession: (sessionId: string) => void;
};

function formatCheckInDate(startAt: string): string {
  return format(new Date(startAt), 'EEE, d MMM yyyy');
}

function formatCheckInTime(startAt: string, endAt: string | null): string {
  const start = new Date(startAt);
  const end = endAt ? new Date(endAt) : null;
  if (end) {
    return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`;
  }
  return format(start, 'HH:mm');
}

function formatStaffMemberName(member: PayTierCheckInStaffMember): string {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ').trim();
  return name || 'Staff member';
}

export function PayTierCheckInsTable({ checkIns, onOpenSession }: PayTierCheckInsTableProps) {
  return (
    <section aria-labelledby="check-ins-heading" className="space-y-4">
      <h2 id="check-ins-heading" className="text-2xl font-semibold">
        Check-ins
      </h2>

      <div className={tutorTableShell}>
        <Table>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className={tutorTableHeaderRow}>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Conducted by</TableHead>
              <TableHead className="w-[120px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checkIns.length === 0 ? (
              <TableRow className={tutorTableBodyRow}>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No check-in sessions yet.
                </TableCell>
              </TableRow>
            ) : (
              checkIns.map((row) => {
                const hosts = row.conductingStaff ?? row.otherStaff ?? [];
                return (
                  <TableRow key={row.sessionId} className={tutorTableBodyRow}>
                    <TableCell className="tabular-nums font-medium">
                      {formatCheckInDate(row.startAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatCheckInTime(row.startAt, row.endAt)}
                    </TableCell>
                    <TableCell>
                      {hosts.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        <p className="text-sm">{hosts.map(formatStaffMemberName).join(', ')}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        className={tutorBtnPrimary}
                        onClick={() => onOpenSession(row.sessionId)}
                      >
                        <Eye className="mr-1.5 h-3.5 w-3.5" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
