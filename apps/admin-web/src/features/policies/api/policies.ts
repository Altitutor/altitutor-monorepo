import type { JSONContent } from '@tiptap/core';

export type PolicyRow = {
  id: string;
  key: string;
  content: unknown;
  updated_at: string;
};

export const policiesApi = {
  async getPolicy(key: string): Promise<PolicyRow | null> {
    const res = await fetch(`/api/policies/${encodeURIComponent(key)}`);
    if (!res.ok) {
      if (res.status === 404) return null;
      throw new Error((await res.json()).error || 'Failed to fetch policy');
    }
    return res.json();
  },

  async updatePolicy(key: string, content: JSONContent): Promise<PolicyRow> {
    const res = await fetch(`/api/policies/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      throw new Error((await res.json()).error || 'Failed to update policy');
    }
    return res.json();
  },
};
