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
  Input,
  Label,
} from '@altitutor/ui';
import { Loader2, Plus } from 'lucide-react';
import { formatPayRate, type StaffPayTier } from '@altitutor/shared/pay-tiers';
import {
  usePayTierRequirements,
  useUpdatePayTier,
  useDeletePayTier,
  useAddPayTierRequirement,
} from '../hooks';
import {
  hasTenureRequirement,
  PayTierRequirementEditor,
} from './PayTierRequirementEditor';

type PayTierEditDialogProps = {
  tier: StaffPayTier | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isTopTier: boolean;
  canDelete: boolean;
};

export function PayTierEditDialog({
  tier,
  open,
  onOpenChange,
  isTopTier,
  canDelete,
}: PayTierEditDialogProps) {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');

  const requirementsQuery = usePayTierRequirements(tier?.tier_number ?? 0, open && !!tier);
  const updateTier = useUpdatePayTier();
  const deleteTier = useDeletePayTier();
  const addRequirement = useAddPayTierRequirement();

  useEffect(() => {
    if (!tier) return;
    setName(tier.name ?? '');
    setRate(String(tier.base_pay_rate_cents / 100));
  }, [tier]);

  if (!tier) return null;

  const requirements = requirementsQuery.data ?? [];
  const saving = updateTier.isPending;
  const hasTenure = hasTenureRequirement(requirements);

  const handleSave = async () => {
    const cents = Math.round(parseFloat(rate) * 100);
    if (Number.isNaN(cents)) return;
    await updateTier.mutateAsync({
      tierNumber: tier.tier_number,
      updates: { base_pay_rate_cents: cents, name: name || null },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Tier {tier.tier_number}
            {tier.name ? ` — ${tier.name}` : ''}
          </DialogTitle>
          <DialogDescription>
            Base pay {formatPayRate(tier.base_pay_rate_cents, tier.currency)}/hr
            {!isTopTier ? ` · Requirements to reach tier ${tier.tier_number + 1}` : ' · Top tier (no requirements)'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tier-name">Name</Label>
              <Input id="tier-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tier-rate">Base pay ($/hr)</Label>
              <Input
                id="tier-rate"
                type="number"
                step="0.01"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>

          {!isTopTier && (
            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Advancement requirements</p>
              {requirementsQuery.isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ul className="space-y-2 text-sm">
                  {requirements.map((req) => (
                    <PayTierRequirementEditor
                      key={req.id}
                      tierNumber={tier.tier_number}
                      requirement={req}
                    />
                  ))}
                  {requirements.length === 0 && (
                    <p className="text-sm text-muted-foreground">No requirements yet.</p>
                  )}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {!hasTenure && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={addRequirement.isPending}
                    onClick={() =>
                      addRequirement.mutate({
                        tierNumber: tier.tier_number,
                        requirement_kind: 'TENURE_MONTHS',
                        params: { min: 1 },
                      })
                    }
                  >
                    <Plus className="h-3 w-3 mr-1" /> Tenure
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={addRequirement.isPending}
                  onClick={() =>
                    addRequirement.mutate({
                      tierNumber: tier.tier_number,
                      requirement_kind: 'SESSION_COUNT',
                      params: {
                        min: 0,
                        session_types: ['CLASS'],
                        attendance_types: ['MAIN_TUTOR'],
                      },
                    })
                  }
                >
                  <Plus className="h-3 w-3 mr-1" /> Session count
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                One tenure rule per tier (months employed). Edit values below; changes save when you leave a field or
                click Apply on session rules.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {canDelete ? (
            <Button
              variant="destructive"
              disabled={deleteTier.isPending}
              onClick={async () => {
                await deleteTier.mutateAsync(tier.tier_number);
                onOpenChange(false);
              }}
            >
              {deleteTier.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove tier'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
