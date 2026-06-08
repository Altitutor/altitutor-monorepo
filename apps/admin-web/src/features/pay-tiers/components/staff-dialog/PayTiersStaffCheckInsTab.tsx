'use client';

import { useState } from 'react';
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
import {
  formatPayTierPromotionOutcome,
  type PayTierCheckIn,
  type StaffTierProgress,
} from '@altitutor/shared/pay-tiers';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import { PayTierCheckInReviewDialog } from './PayTierCheckInReviewDialog';

type PayTiersStaffCheckInsTabProps = {
  staffId: string;
  staffFirstName: string | null;
  staffLastName: string | null;
  progress: StaffTierProgress;
  onOpenSession: (sessionId: string) => void;
};

export function PayTiersStaffCheckInsTab({
  staffId,
  staffFirstName,
  staffLastName,
  progress,
  onOpenSession,
}: PayTiersStaffCheckInsTabProps) {
  const { openCheckInModal } = useQuickActions();
  const [reviewCheckIn, setReviewCheckIn] = useState<PayTierCheckIn | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const checkIns = progress.checkIns;

  const tierLabel = (tierNumber: number | undefined, name: string | null | undefined) =>
    name ? `Tier ${tierNumber} — ${name}` : `Tier ${tierNumber ?? '—'}`;

  const formatConducting = (row: PayTierCheckIn) => {
    const hosts = row.conductingStaff ?? row.otherStaff ?? [];
    if (hosts.length === 0) return '—';
    return hosts
      .map((m) => [m.firstName, m.lastName].filter(Boolean).join(' ').trim() || 'Staff')
      .join(', ');
  };

  const openReviewDialog = (row: PayTierCheckIn) => {
    setReviewCheckIn(row);
    setReviewDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Check-ins with pay tier at session time and promotion reviews.
        </p>
        <Button
          size="sm"
          onClick={() =>
            openCheckInModal({
              staff: [
                {
                  id: staffId,
                  first_name: staffFirstName,
                  last_name: staffLastName,
                },
              ],
            })
          }
        >
          Book check in
        </Button>
      </div>

      <div className="rounded-md border max-h-[min(420px,50vh)] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Conducted by</TableHead>
              <TableHead>Tier at check-in</TableHead>
              <TableHead>Review</TableHead>
              <TableHead className="text-right w-[220px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {checkIns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-16 text-center text-muted-foreground">
                  No check-ins recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              checkIns.map((row) => {
                const promo = row.linkedPromotion;
                return (
                  <TableRow key={row.sessionId}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(row.startAt).toLocaleDateString('en-AU', { dateStyle: 'medium' })}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px]">
                      {formatConducting(row)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {tierLabel(row.tierAtCheckIn, row.tierName)}
                    </TableCell>
                    <TableCell className="text-sm max-w-[240px]">
                      {promo ? (
                        <div className="space-y-1">
                          <Badge variant={promo.outcome === 'approved' ? 'default' : 'secondary'}>
                            {formatPayTierPromotionOutcome(promo.outcome)}
                            {promo.outcome === 'approved' &&
                              promo.from_tier_number !== promo.to_tier_number &&
                              ` → ${promo.to_tier_number}`}
                          </Badge>
                          {promo.notes ? (
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                              {promo.notes}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenSession(row.sessionId)}
                        >
                          View session
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={promo ? 'outline' : 'default'}
                          onClick={() => openReviewDialog(row)}
                        >
                          {promo ? 'Edit review' : 'Add review'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <PayTierCheckInReviewDialog
        open={reviewDialogOpen}
        onOpenChange={(open) => {
          setReviewDialogOpen(open);
          if (!open) setReviewCheckIn(null);
        }}
        staffId={staffId}
        checkIn={reviewCheckIn}
        progress={progress}
      />
    </div>
  );
}
