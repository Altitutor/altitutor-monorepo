'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import {
  formatPayRate,
  type StaffTierPromotionOutcome,
} from '@altitutor/shared/pay-tiers';
import { useToast } from '@altitutor/ui';
import { useQuickActions } from '@/shared/contexts/QuickActionsContext';
import {
  usePayTierStaffProgress,
  useUpdateStaffTierProfile,
  useRecordPayTierPromotion,
} from '../hooks';

export function PayTiersStaffPanel({
  staffId,
  staffName,
  staffFirstName,
  staffLastName,
}: {
  staffId: string;
  staffName: string;
  staffFirstName?: string;
  staffLastName?: string;
}) {
  const { toast } = useToast();
  const { openCheckInModal } = useQuickActions();
  const { data: progress, isLoading, isError, error } = usePayTierStaffProgress(staffId);
  const updateProfile = useUpdateStaffTierProfile();
  const recordPromotion = useRecordPayTierPromotion();

  const [employmentDate, setEmploymentDate] = useState('');
  const [overridesJson, setOverridesJson] = useState('{}');
  const [promotionOutcome, setPromotionOutcome] = useState<StaffTierPromotionOutcome>('deferred');
  const [promotionNotes, setPromotionNotes] = useState('');
  const [checkInSessionId, setCheckInSessionId] = useState('');

  useEffect(() => {
    if (!progress) return;
    setEmploymentDate(progress.employmentStartedAt.slice(0, 10));
    setOverridesJson(JSON.stringify(progress.metricOverrides, null, 2));
  }, [progress]);

  useEffect(() => {
    if (isError) {
      toast({
        title: 'Failed to load pay tier',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  }, [isError, error, toast]);

  if (isLoading || !progress) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const currentTier = progress.tiers.find((t) => t.tier_number === progress.currentTierNumber);
  const nextTier = progress.nextTierNumber
    ? progress.tiers.find((t) => t.tier_number === progress.nextTierNumber)
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">{staffName}</h3>
        <p className="text-sm text-muted-foreground">
          Tier {progress.currentTierNumber}
          {currentTier?.name ? ` (${currentTier.name})` : ''}
          {currentTier
            ? ` — ${formatPayRate(currentTier.base_pay_rate_cents, currentTier.currency)}/hr`
            : ''}
        </p>
        {progress.isEligibleForReview && (
          <Badge className="mt-2" variant="default">
            Eligible for tier review
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <Label>Employment start date</Label>
        <div className="flex gap-2">
          <Input type="date" value={employmentDate} onChange={(e) => setEmploymentDate(e.target.value)} />
          <Button
            variant="outline"
            disabled={updateProfile.isPending}
            onClick={async () => {
              try {
                await updateProfile.mutateAsync({
                  staffId,
                  updates: { employment_started_at: new Date(employmentDate).toISOString() },
                });
                toast({ title: 'Employment date updated' });
              } catch (e) {
                toast({
                  title: 'Update failed',
                  description: e instanceof Error ? e.message : 'Unknown error',
                  variant: 'destructive',
                });
              }
            }}
          >
            Save
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Metric overrides (JSON, additive)</Label>
        <Textarea
          className="font-mono text-xs min-h-[100px]"
          value={overridesJson}
          onChange={(e) => setOverridesJson(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={updateProfile.isPending}
          onClick={async () => {
            try {
              const parsed = JSON.parse(overridesJson) as Record<string, number>;
              await updateProfile.mutateAsync({
                staffId,
                updates: { metric_overrides: parsed },
              });
              toast({ title: 'Overrides updated' });
            } catch (e) {
              toast({
                title: 'Invalid JSON or save failed',
                description: e instanceof Error ? e.message : 'Unknown error',
                variant: 'destructive',
              });
            }
          }}
        >
          Save overrides
        </Button>
      </div>

      {nextTier && progress.requirementsForNextTier.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Progress toward tier {nextTier.tier_number}</p>
          <ul className="space-y-2 text-sm">
            {progress.requirementsForNextTier.map((r) => (
              <li key={r.id} className="rounded border p-2">
                <div className="flex justify-between">
                  <span>{r.label}</span>
                  <span className={r.met ? 'text-green-600' : 'text-muted-foreground'}>
                    {r.current} / {r.required}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, r.required > 0 ? (r.current / r.required) * 100 : 0)}%`,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {progress.lastCheckIn && (
        <p className="text-sm text-muted-foreground">
          Last check-in:{' '}
          {new Date(progress.lastCheckIn.startAt).toLocaleDateString('en-AU', {
            dateStyle: 'medium',
          })}
          {progress.lastCheckIn.longName ? ` — ${progress.lastCheckIn.longName}` : ''}
        </p>
      )}

      <Button
        variant="outline"
        onClick={() =>
          openCheckInModal({
            staff: [
              {
                id: staffId,
                first_name: staffFirstName ?? staffName.split(' ')[0] ?? null,
                last_name: staffLastName ?? (staffName.split(' ').slice(1).join(' ') || null),
              },
            ],
          })
        }
      >
        Book check in
      </Button>

      {progress.nextTierNumber && (
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Record promotion review</p>
          <div className="space-y-2">
            <Label>CHECK_IN session ID (optional)</Label>
            <Input
              value={checkInSessionId}
              onChange={(e) => setCheckInSessionId(e.target.value)}
              placeholder="UUID of completed check-in session"
            />
          </div>
          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select
              value={promotionOutcome}
              onValueChange={(v) => setPromotionOutcome(v as StaffTierPromotionOutcome)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved — promote to tier {progress.nextTierNumber}</SelectItem>
                <SelectItem value="deferred">Deferred</SelectItem>
                <SelectItem value="not_ready">Not ready</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            placeholder="Notes"
            value={promotionNotes}
            onChange={(e) => setPromotionNotes(e.target.value)}
          />
          <Button
            disabled={recordPromotion.isPending}
            onClick={async () => {
              try {
                const result = await recordPromotion.mutateAsync({
                  staffId,
                  payload: {
                    outcome: promotionOutcome,
                    check_in_session_id: checkInSessionId || null,
                    notes: promotionNotes || null,
                  },
                });
                toast({
                  title: 'Review recorded',
                  description: result.quickbooksReminder,
                });
              } catch (e) {
                toast({
                  title: 'Failed to record review',
                  description: e instanceof Error ? e.message : 'Unknown error',
                  variant: 'destructive',
                });
              }
            }}
          >
            {recordPromotion.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Submit review'
            )}
          </Button>
        </div>
      )}

      {progress.promotions.length > 0 && (
        <div className="space-y-2 border-t pt-4">
          <p className="text-sm font-medium">Promotion history</p>
          <ul className="text-sm space-y-1 text-muted-foreground">
            {progress.promotions.map((p) => (
              <li key={p.id}>
                {new Date(p.reviewed_at).toLocaleDateString('en-AU')}: {p.outcome}
                {p.from_tier_number !== p.to_tier_number
                  ? ` (tier ${p.from_tier_number} → ${p.to_tier_number})`
                  : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
