'use client';

import { format } from 'date-fns';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Eye } from 'lucide-react';
import type { PayTierCheckIn } from '@altitutor/shared/pay-tiers';
import { formatPayTierPromotionOutcome } from '@altitutor/shared/pay-tiers';
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

export function PayTierCheckInsTable({ checkIns, onOpenSession }: PayTierCheckInsTableProps) {
  return (
    <section aria-labelledby="check-ins-heading" className="space-y-4">
      <h2 id="check-ins-heading" className="text-2xl font-semibold">
        Check-ins
      </h2>
      <p className="text-sm text-muted-foreground">
        Tier reviews are linked to check-in sessions. Use View to open session details.
      </p>

      <div className={tutorTableShell}>
        <Table>
          <TableHeader className="[&_tr]:border-b-0">
            <TableRow className={tutorTableHeaderRow}>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Promotion review</TableHead>
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
                const promo = row.linkedPromotion;
                return (
                  <TableRow key={row.sessionId} className={tutorTableBodyRow}>
                    <TableCell className="tabular-nums font-medium">
                      {formatCheckInDate(row.startAt)}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {formatCheckInTime(row.startAt, row.endAt)}
                    </TableCell>
                    <TableCell>
                      {promo ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={promo.outcome === 'approved' ? 'default' : 'secondary'}>
                            {formatPayTierPromotionOutcome(promo.outcome)}
                          </Badge>
                          {promo.from_tier_number !== promo.to_tier_number ? (
                            <span className="text-xs text-muted-foreground">
                              Tier {promo.from_tier_number} → {promo.to_tier_number}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
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
