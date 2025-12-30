import type { Tables } from '@altitutor/shared';

export type BlockoutRow = Tables<'booking_staff_unavailability'>;

export interface CreateBlockoutInput {
  start_at: string; // ISO timestamp
  end_at: string; // ISO timestamp
  reason?: string;
}

export interface UpdateBlockoutInput {
  start_at?: string;
  end_at?: string;
  reason?: string;
}

export const blockoutsApi = {
  async getMyBlockouts(): Promise<BlockoutRow[]> {
    const response = await fetch('/api/blockouts');
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch blockouts');
    }
    const result = await response.json();
    return result.data ?? [];
  },

  async createBlockout(input: CreateBlockoutInput): Promise<BlockoutRow> {
    const response = await fetch('/api/blockouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create blockout');
    }
    const result = await response.json();
    return result.data;
  },

  async updateBlockout(
    id: string,
    updates: UpdateBlockoutInput
  ): Promise<BlockoutRow> {
    const response = await fetch(`/api/blockouts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update blockout');
    }
    const result = await response.json();
    return result.data;
  },

  async deleteBlockout(id: string): Promise<void> {
    const response = await fetch(`/api/blockouts/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete blockout');
    }
  },
};

