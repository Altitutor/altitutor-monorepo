'use client';

import { useEffect, useState } from 'react';
import type { Tables, Database } from '@altitutor/shared';
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type PaymentMethod = Tables<'student_payment_methods'>;

export function StudentBillingTab({ student }: { student: Tables<'students'> }) {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('student_payment_methods')
        .select('*')
        .eq('student_id', student.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPaymentMethods(data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id]);

  const handleRemoveMethod = async (methodId: string, isDefault: boolean) => {
    if (isDefault) {
      alert('Cannot remove default payment method. Student must set a different card as default first.');
      return;
    }

    if (!confirm('Remove this payment method?')) return;

    const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('student_payment_methods')
      .delete()
      .eq('id', methodId);
    
    if (error) {
      alert('Failed to remove payment method');
      return;
    }
    load();
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        View the student's saved payment methods.
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : paymentMethods.length === 0 ? (
        <div className="text-sm text-muted-foreground">No payment methods on file.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((method) => (
            <Card key={method.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="capitalize">{method.card_brand}</span>
                  {method.is_default && (
                    <Badge variant="default">Default</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm">Last 4: ****{method.card_last4}</div>
                  <div className="text-sm">
                    Expires: {method.card_exp_month}/{method.card_exp_year}
                  </div>
                  <div className="text-sm">Country: {method.card_country || '-'}</div>
                  <div className="text-xs text-muted-foreground break-all">
                    ID: {method.stripe_payment_method_id.substring(0, 20)}...
                  </div>
                  {!method.is_default && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleRemoveMethod(method.id, method.is_default)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}



