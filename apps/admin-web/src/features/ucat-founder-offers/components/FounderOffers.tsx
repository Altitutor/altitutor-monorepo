'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Ban, Copy, Eye, PlayCircle } from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { ucatFounderOfferDescription } from '@altitutor/shared';
import {
  AdminDialogShell,
  SettingsDataTable,
  type SettingsDataTableColumn,
} from '@/shared/components';
import {
  createFounderOffer,
  listFounderOffers,
  setFounderOfferActive,
  type FounderOffer,
} from '../api/founder-offers';

type OfferKind = 'access_pass' | 'discount';
type DurationUnit = 'week' | 'month';
type Availability = 'Available' | 'Disabled' | 'Expired' | 'Fully claimed';

type CreateFormState = {
  name: string;
  campaign: string;
  code: string;
  kind: OfferKind;
  durationCount: string;
  durationUnit: DurationUnit;
  percentOff: string;
  maxRedemptions: string;
  expiresAt: string;
};

const EMPTY_FORM: CreateFormState = {
  name: '',
  campaign: '',
  code: '',
  kind: 'access_pass',
  durationCount: '2',
  durationUnit: 'week',
  percentOff: '20',
  maxRedemptions: '',
  expiresAt: '',
};

function isOfferKind(value: string): value is OfferKind {
  return value === 'access_pass' || value === 'discount';
}

function isDurationUnit(value: string): value is DurationUnit {
  return value === 'week' || value === 'month';
}

function redemptionCounts(offer: FounderOffer) {
  const used = offer.ucat_founder_redemptions.filter((row) => row.status === 'redeemed').length;
  const pending = offer.ucat_founder_redemptions.filter((row) => row.status === 'reserved').length;
  return { used, pending };
}

function availabilityLabel(offer: FounderOffer): Availability {
  const { used, pending } = redemptionCounts(offer);
  if (!offer.active) return 'Disabled';
  if (offer.expires_at && Date.parse(offer.expires_at) <= Date.now()) return 'Expired';
  if (offer.max_redemptions !== null && used + pending >= offer.max_redemptions) return 'Fully claimed';
  return 'Available';
}

function invitationUrl(offer: FounderOffer) {
  const url = new URL(
    `/invite/${offer.code}`,
    process.env.NEXT_PUBLIC_UCAT_WEB_URL || 'https://ucat.altitutor.com',
  );
  url.searchParams.set('utm_source', 'founder');
  url.searchParams.set('utm_medium', 'invitation');
  url.searchParams.set('utm_campaign', offer.campaign);
  return url.toString();
}

function studentLabel(studentId: string) {
  return `Student ${studentId.slice(0, 8)}`;
}

export function FounderOffers({ onCreateTrigger = 0 }: { onCreateTrigger?: number }) {
  const [offers, setOffers] = useState<FounderOffer[]>([]);
  const [form, setForm] = useState<CreateFormState>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [viewingOffer, setViewingOffer] = useState<FounderOffer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setOffers(await listFounderOffers());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load offers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (onCreateTrigger > 0) {
      setForm(EMPTY_FORM);
      setError(null);
      setIsCreating(true);
    }
  }, [onCreateTrigger]);

  const columns = useMemo<SettingsDataTableColumn<FounderOffer>[]>(
    () => [
      {
        key: 'name',
        label: 'Offer',
        render: (offer) => (
          <div>
            <div className="font-medium">{offer.name}</div>
            <div className="font-mono text-xs">{offer.code}</div>
            <div className="text-xs text-muted-foreground">{offer.campaign}</div>
          </div>
        ),
        sortValue: (offer) => offer.name,
        searchValue: (offer) => `${offer.name} ${offer.code} ${offer.campaign}`,
      },
      {
        key: 'kind',
        label: 'Benefit',
        render: (offer) => ucatFounderOfferDescription(offer),
        sortValue: (offer) => ucatFounderOfferDescription(offer),
        filterValue: (offer) => offer.kind,
        searchValue: (offer) => ucatFounderOfferDescription(offer),
      },
      {
        key: 'usage',
        label: 'Usage',
        render: (offer) => {
          const { used, pending } = redemptionCounts(offer);
          return (
            <div>
              <span className="font-mono tabular-nums">
                {used} / {offer.max_redemptions ?? 'Unlimited'}
              </span>
              {pending > 0 ? (
                <p className="text-xs text-muted-foreground">{pending} reserved at checkout</p>
              ) : null}
            </div>
          );
        },
        sortValue: (offer) => redemptionCounts(offer).used,
      },
      {
        key: 'availability',
        label: 'Availability',
        render: (offer) => {
          const label = availabilityLabel(offer);
          return (
            <div>
              <span className={label === 'Available' ? undefined : 'text-muted-foreground'}>{label}</span>
              {offer.expires_at ? (
                <p className="text-xs text-muted-foreground">
                  Until {new Date(offer.expires_at).toLocaleString()}
                </p>
              ) : null}
            </div>
          );
        },
        sortValue: (offer) => availabilityLabel(offer),
        filterValue: (offer) => availabilityLabel(offer),
        searchValue: (offer) => availabilityLabel(offer),
      },
      {
        key: 'created_at',
        label: 'Created',
        render: (offer) => (
          <span className="text-muted-foreground">{new Date(offer.created_at).toLocaleDateString()}</span>
        ),
        sortValue: (offer) => offer.created_at,
      },
    ],
    [],
  );

  function closeCreate() {
    setIsCreating(false);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleCreate() {
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await createFounderOffer({
        code: form.code,
        name: form.name,
        campaign: form.campaign,
        kind: form.kind,
        duration_count: parseInt(form.durationCount, 10),
        duration_unit: form.durationUnit,
        percent_off: parseInt(form.percentOff, 10),
        max_redemptions: form.maxRedemptions.trim() ? parseInt(form.maxRedemptions, 10) : null,
        expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      });
      closeCreate();
      setNotice('Offer created. Copy its invitation link from the row actions.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create offer.');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(offer: FounderOffer) {
    setTogglingId(offer.id);
    setError(null);
    try {
      await setFounderOfferActive(offer.id, !offer.active);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update offer.');
    } finally {
      setTogglingId(null);
    }
  }

  async function copyLink(offer: FounderOffer) {
    try {
      await navigator.clipboard.writeText(invitationUrl(offer));
      setNotice('Invitation link copied.');
      setError(null);
    } catch {
      setError('Could not copy the link. Check clipboard permissions.');
    }
  }

  return (
    <>
      <div className="space-y-4">
      {error && !isCreating ? <p className="text-sm text-destructive">{error}</p> : null}
      {notice ? (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      ) : null}

      <SettingsDataTable
        data={offers}
        columns={columns}
        getRowId={(offer) => offer.id}
        emptyMessage="No founder offers yet"
        searchPlaceholder="Search founder offers..."
        filterKeys={['kind', 'availability']}
        filterDefinitions={[
          {
            key: 'kind',
            label: 'Benefit',
            options: [
              { label: 'Free Unlimited access', value: 'access_pass' },
              { label: 'Recurring percentage discount', value: 'discount' },
            ],
          },
          {
            key: 'availability',
            label: 'Availability',
            options: [
              { label: 'Available', value: 'Available' },
              { label: 'Disabled', value: 'Disabled' },
              { label: 'Expired', value: 'Expired' },
              { label: 'Fully claimed', value: 'Fully claimed' },
            ],
          },
        ]}
        defaultSort={{ field: 'created_at', direction: 'desc' }}
        isLoading={loading}
        getActions={(offer) => [
          {
            id: 'copy-link',
            label: 'Copy invitation link',
            icon: Copy,
            onSelect: () => void copyLink(offer),
          },
          {
            id: 'view-redemptions',
            label: 'View redemptions',
            icon: Eye,
            onSelect: () => setViewingOffer(offer),
          },
          {
            id: offer.active ? 'disable' : 'enable',
            label: offer.active ? 'Disable' : 'Enable',
            icon: offer.active ? Ban : PlayCircle,
            disabled: togglingId === offer.id,
            onSelect: () => void toggle(offer),
          },
        ]}
      />
      </div>

      <AdminDialogShell
        open={isCreating}
        onClose={closeCreate}
        title="New founder offer"
        subtitle="Offer terms are fixed once created. Disable a code later to stop new claims."
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeCreate} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleCreate()} disabled={saving}>
              {saving ? 'Saving…' : 'Create offer'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="offer-name">Offer name</Label>
            <Input
              id="offer-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
              maxLength={100}
              placeholder="Founding students"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-campaign">Campaign</Label>
            <Input
              id="offer-campaign"
              value={form.campaign}
              onChange={(event) => setForm((current) => ({ ...current, campaign: event.target.value }))}
              required
              maxLength={100}
              placeholder="founders-2026"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-code">Code</Label>
            <Input
              id="offer-code"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
              required
              maxLength={42}
              pattern="[A-Za-z0-9][A-Za-z0-9-]{2,41}"
              placeholder="FOUNDERS"
            />
            <p className="text-xs text-muted-foreground">
              Letters, numbers, and hyphens. Use a different code for each person or
              distribution source.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-kind">Benefit</Label>
            <Select
              value={form.kind}
              onValueChange={(value) => {
                if (isOfferKind(value)) setForm((current) => ({ ...current, kind: value }));
              }}
            >
              <SelectTrigger id="offer-kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="access_pass">Free Unlimited access</SelectItem>
                <SelectItem value="discount">Recurring percentage discount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.kind === 'access_pass' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="offer-duration">Free duration</Label>
                <Input
                  id="offer-duration"
                  type="number"
                  min={1}
                  max={24}
                  value={form.durationCount}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, durationCount: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-unit">Duration unit</Label>
                <Select
                  value={form.durationUnit}
                  onValueChange={(value) => {
                    if (isDurationUnit(value)) {
                      setForm((current) => ({ ...current, durationUnit: value }));
                    }
                  }}
                >
                  <SelectTrigger id="offer-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Weeks</SelectItem>
                    <SelectItem value="month">Calendar months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="offer-percent">Discount (%)</Label>
              <Input
                id="offer-percent"
                type="number"
                min={1}
                max={100}
                value={form.percentOff}
                onChange={(event) => setForm((current) => ({ ...current, percentOff: event.target.value }))}
                required
              />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="offer-limit">Maximum uses (blank = unlimited)</Label>
            <Input
              id="offer-limit"
              type="number"
              min={1}
              step={1}
              value={form.maxRedemptions}
              onChange={(event) =>
                setForm((current) => ({ ...current, maxRedemptions: event.target.value }))
              }
              placeholder="1 for a personal gift"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-expiry">Redeem by (optional, your local time)</Label>
            <Input
              id="offer-expiry"
              type="datetime-local"
              value={form.expiresAt}
              onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))}
            />
          </div>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Free passes need no card and never renew automatically. Discounts apply to weekly, monthly or
          yearly Unlimited at checkout and end with the subscription. Earned practice and referral rewards
          remain available.
        </p>
        {error && isCreating ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}
      </AdminDialogShell>

      <AdminDialogShell
        open={!!viewingOffer}
        onClose={() => setViewingOffer(null)}
        title={viewingOffer ? `${viewingOffer.name} redemptions` : 'Redemptions'}
        subtitle={viewingOffer ? viewingOffer.code : undefined}
        footer={
          <Button type="button" variant="outline" onClick={() => setViewingOffer(null)}>
            Close
          </Button>
        }
      >
        {viewingOffer && viewingOffer.ucat_founder_redemptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No redemptions yet.</p>
        ) : (
          <ul className="space-y-3">
            {viewingOffer?.ucat_founder_redemptions.map((redemption) => (
              <li key={redemption.id} className="text-sm">
                <Link className="font-medium underline" href={`/students/${redemption.student_id}`}>
                  {studentLabel(redemption.student_id)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {redemption.status === 'redeemed'
                    ? `Redeemed ${redemption.redeemed_at ? new Date(redemption.redeemed_at).toLocaleString() : ''}`
                    : 'Reserved at checkout'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </AdminDialogShell>
    </>
  );
}
