'use client';

import { useEffect, useState } from 'react';
import type { Tables } from '@altitutor/shared';
import { Card, CardHeader, CardTitle, CardContent, Button } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

export function StudentBillingTab({ student }: { student: Tables<'students'> }) {
  const [billing, setBilling] = useState<Tables<'students_billing'> | null>(null as any);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await getSupabaseClient()
        .from('students_billing')
        .select('*')
        .eq('student_id', student.id)
        .maybeSingle();
      if (error) throw error;
      setBilling((data as any) || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const handleRemoveMethod = async () => {
    if (!billing) return;
    // For MVP, clear default_payment_method_id; a full solution would call Stripe to detach
    const { error } = await getSupabaseClient()
      .from('students_billing')
      .update({ default_payment_method_id: null, card_brand: null, card_last4: null, card_country: null })
      .eq('student_id', student.id);
    if (error) return;
    load();
  };

  // Setting default would be via student flow; for admin, we only allow clearing for now

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Manage the student's saved payment method. For security, card details are not stored here—only Stripe references.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Default Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div>Loading…</div>
            ) : billing?.default_payment_method_id ? (
              <div className="space-y-2">
                <div className="text-sm">Brand: {billing.card_brand || '-'}</div>
                <div className="text-sm">Last4: {billing.card_last4 || '-'}</div>
                <div className="text-sm">Country: {billing.card_country || '-'}</div>
                <div className="text-sm">Verified: {billing.verified_at ? new Date(billing.verified_at as unknown as string).toLocaleString() : '-'}</div>
                <div className="text-xs text-muted-foreground break-all">PM: {billing.default_payment_method_id}</div>
                <Button variant="outline" onClick={handleRemoveMethod}>Remove</Button>
              </div>
            ) : (
              <div className="text-sm">No default payment method on file.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}



