'use client';

import { useState, useEffect, useCallback } from 'react';
import { RichTextEditor, type JSONContent } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { policiesApi, type PolicyRow } from '../api/policies';

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph', content: [] }],
};

export function BillingPolicyEditor() {
  const [, setPolicy] = useState<PolicyRow | null>(null);
  const [content, setContent] = useState<JSONContent>(EMPTY_DOC);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await policiesApi.getPolicy('billing_policy');
      setPolicy(data);
      if (data?.content && typeof data.content === 'object') {
        setContent(data.content as JSONContent);
      } else {
        setContent(EMPTY_DOC);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load policy');
      setContent(EMPTY_DOC);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicy();
  }, [loadPolicy]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await policiesApi.updatePolicy('billing_policy', content);
      setPolicy((prev) => (prev ? { ...prev, content, updated_at: new Date().toISOString() } : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold mb-2">Billing Policy</h2>
        <p className="text-sm text-muted-foreground mb-4">
          This policy is shown to students during registration when they add a payment method. Students must agree to it before completing registration.
        </p>
        <RichTextEditor
          content={content}
          onChange={setContent}
          placeholder="Enter the billing policy content..."
          minHeight="300px"
        />
      </div>

      {error && (
        <div className="text-sm text-destructive">{error}</div>
      )}

      <Button onClick={handleSave} disabled={saving}>
        {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {saving ? 'Saving...' : 'Save Policy'}
      </Button>
    </div>
  );
}
