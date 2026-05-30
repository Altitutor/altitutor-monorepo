'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@altitutor/ui';
import { Loader2, X } from 'lucide-react';
import {
  formatPayRate,
  type PayTierCheckIn,
  type StaffTierPromotionOutcome,
  type StaffTierProgress,
} from '@altitutor/shared/pay-tiers';
import { useToast } from '@altitutor/ui';
import { useRecordPayTierPromotion, useUpdatePayTierPromotion } from '../../hooks';

type PayTierCheckInReviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffId: string;
  checkIn: PayTierCheckIn | null;
  progress: StaffTierProgress;
};

export function PayTierCheckInReviewDialog({
  open,
  onOpenChange,
  staffId,
  checkIn,
  progress,
}: PayTierCheckInReviewDialogProps) {
  const { toast } = useToast();
  const recordPromotion = useRecordPayTierPromotion();
  const updatePromotion = useUpdatePayTierPromotion();

  const existing = checkIn?.linkedPromotion ?? null;
  const isEdit = !!existing;

  const [outcome, setOutcome] = useState<StaffTierPromotionOutcome>('deferred');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open || !checkIn) return;
    setOutcome(existing?.outcome ?? 'deferred');
    setNotes(existing?.notes ?? '');
  }, [open, checkIn, existing?.outcome, existing?.notes]);

  const handleClose = () => onOpenChange(false);

  const promoteToTier = isEdit
    ? existing!.from_tier_number + 1
    : progress.nextTierNumber;
  const canApprove = promoteToTier
    ? progress.tiers.some((t) => t.tier_number === promoteToTier)
    : false;
  const nextTierMeta = promoteToTier
    ? progress.tiers.find((t) => t.tier_number === promoteToTier)
    : undefined;

  const checkInLabel = checkIn
    ? new Date(checkIn.startAt).toLocaleDateString('en-AU', { dateStyle: 'medium' })
    : '';

  const isPending = recordPromotion.isPending || updatePromotion.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-md flex flex-col p-0 gap-0 [&>button]:hidden">
        <div className="flex-shrink-0 border-b bg-background">
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-start gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="min-w-0 flex-1">
                <DialogTitle>{isEdit ? 'Edit promotion review' : 'Add promotion review'}</DialogTitle>
                <DialogDescription>
                  {checkInLabel ? `Check-in on ${checkInLabel}` : 'Record outcome and notes for this check-in.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 py-4 space-y-4">
          {promoteToTier && (
            <p className="text-xs text-muted-foreground">
              Promote to tier: {promoteToTier}
              {nextTierMeta
                ? ` — ${formatPayRate(nextTierMeta.base_pay_rate_cents, nextTierMeta.currency)}/hr`
                : ''}
            </p>
          )}
          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select
              value={outcome}
              onValueChange={(v) => setOutcome(v as StaffTierPromotionOutcome)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved" disabled={!canApprove}>
                  {canApprove
                    ? `Approved — promote to tier ${promoteToTier}`
                    : 'Approved — no higher tier'}
                </SelectItem>
                <SelectItem value="deferred">Deferred</SelectItem>
                <SelectItem value="not_ready">Not ready</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Optional notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t bg-background">
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isPending || !checkIn}
            onClick={async () => {
              if (!checkIn) return;
              try {
                const payload = {
                  outcome,
                  check_in_session_id: checkIn.sessionId,
                  notes: notes.trim() || null,
                };
                const result = isEdit
                  ? await updatePromotion.mutateAsync({
                      staffId,
                      promotionId: existing.id,
                      payload: { outcome, notes: payload.notes },
                    })
                  : await recordPromotion.mutateAsync({ staffId, payload });
                toast({
                  title: isEdit ? 'Review updated' : 'Review recorded',
                  description: result.quickbooksReminder,
                });
                handleClose();
              } catch (e) {
                toast({
                  title: isEdit ? 'Failed to update review' : 'Failed to record review',
                  description: e instanceof Error ? e.message : 'Unknown error',
                  variant: 'destructive',
                });
              }
            }}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              'Save review'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
