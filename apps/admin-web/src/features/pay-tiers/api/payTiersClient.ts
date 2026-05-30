import type { StaffPayTier, StaffTierProgress, StaffPayTierRequirementKind } from '@altitutor/shared/pay-tiers';

async function parseJson<T>(res: Response): Promise<T> {
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? res.statusText);
  return json;
}

export const payTiersClient = {
  async getTiers(): Promise<StaffPayTier[]> {
    const res = await fetch('/api/pay-tiers');
    const data = await parseJson<{ tiers: StaffPayTier[] }>(res);
    return data.tiers;
  },

  async updateTier(
    tierNumber: number,
    updates: { name?: string | null; base_pay_rate_cents?: number; currency?: string }
  ): Promise<void> {
    const res = await fetch(`/api/pay-tiers/${tierNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    await parseJson(res);
  },

  async createTier(tier: {
    tier_number: number;
    name?: string | null;
    base_pay_rate_cents: number;
    currency?: string;
  }): Promise<void> {
    const res = await fetch('/api/pay-tiers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tier),
    });
    await parseJson(res);
  },

  async deleteTier(tierNumber: number): Promise<void> {
    const res = await fetch(`/api/pay-tiers/${tierNumber}`, { method: 'DELETE' });
    await parseJson(res);
  },

  async getRequirements(tierNumber: number) {
    const res = await fetch(`/api/pay-tiers/${tierNumber}/requirements`);
    const data = await parseJson<{
      requirements: Array<{
        id: string;
        tier_number: number;
        requirement_kind: StaffPayTierRequirementKind;
        params: Record<string, unknown>;
        sort_order: number;
      }>;
    }>(res);
    return data.requirements;
  },

  async addRequirement(
    tierNumber: number,
    payload: {
      requirement_kind: StaffPayTierRequirementKind;
      params: Record<string, unknown>;
      sort_order?: number;
    }
  ): Promise<void> {
    const res = await fetch(`/api/pay-tiers/${tierNumber}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await parseJson(res);
  },

  async updateRequirement(
    tierNumber: number,
    payload: {
      id: string;
      params?: Record<string, unknown>;
      requirement_kind?: StaffPayTierRequirementKind;
    }
  ): Promise<void> {
    const res = await fetch(`/api/pay-tiers/${tierNumber}/requirements`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await parseJson(res);
  },

  async deleteRequirement(tierNumber: number, requirementId: string): Promise<void> {
    const res = await fetch(
      `/api/pay-tiers/${tierNumber}/requirements?id=${encodeURIComponent(requirementId)}`,
      { method: 'DELETE' }
    );
    await parseJson(res);
  },

  async getStaffSummaries() {
    const res = await fetch('/api/pay-tiers/staff');
    return parseJson<{
      staff: Array<{
        staffId: string;
        firstName: string;
        lastName: string;
        role: string;
        status: string;
        currentTierNumber: number;
        nextTierNumber: number | null;
        isEligibleForReview: boolean;
        lastCheckIn: { sessionId: string; startAt: string; longName: string | null } | null;
      }>;
    }>(res);
  },

  async getStaffProgress(staffId: string): Promise<StaffTierProgress> {
    const res = await fetch(`/api/pay-tiers/staff/${staffId}`);
    const data = await parseJson<{ progress: StaffTierProgress }>(res);
    return data.progress;
  },

  async updateStaffTierProfile(
    staffId: string,
    updates: {
      employment_started_at?: string;
      metric_overrides?: Record<string, number>;
      current_tier_number?: number;
    }
  ): Promise<StaffTierProgress> {
    const res = await fetch(`/api/pay-tiers/staff/${staffId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await parseJson<{ progress: StaffTierProgress }>(res);
    return data.progress;
  },

  async recordPromotion(
    staffId: string,
    payload: {
      outcome: 'approved' | 'deferred' | 'not_ready';
      check_in_session_id?: string | null;
      notes?: string | null;
    }
  ): Promise<{ progress: StaffTierProgress; quickbooksReminder?: string }> {
    const res = await fetch(`/api/pay-tiers/staff/${staffId}/promotions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return parseJson(res);
  },
};
