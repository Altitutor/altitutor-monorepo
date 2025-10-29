'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@altitutor/shared';
import { AddCardSheet } from '@/features/auth/components/AddCardSheet';
import { Loader2, CreditCard, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [student, setStudent] = useState<any>(null);
  const [billing, setBilling] = useState<any>(null);
  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Get student record
        const { data: studentData } = await supabase
          .from('students')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        // Get billing info
        const { data: billingData } = await supabase
          .from('students_billing')
          .select('*')
          .eq('student_id', user.id)
          .maybeSingle();

        setStudent(studentData);
        setBilling(billingData);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const hasPaymentMethod = billing?.default_payment_method_id && billing?.verified_at;

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">
          Welcome back, {student?.first_name || 'Student'}!
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and payment methods
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Method
          </CardTitle>
          <CardDescription>
            {hasPaymentMethod
              ? 'Your payment method is set up and ready to use'
              : 'Add a payment method to enable automatic billing for sessions'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPaymentMethod ? (
            <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-900/20">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div className="flex-1">
                <p className="font-medium">
                  {billing.card_brand?.toUpperCase()} •••• {billing.card_last4}
                </p>
                <p className="text-sm text-muted-foreground">
                  Verified on {new Date(billing.verified_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                We'll charge a small verification amount ($0.50 AUD) which will be
                immediately refunded. This confirms your card is valid.
              </p>
              <AddCardSheet
                studentId={student?.id}
                onSuccess={() => window.location.reload()}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Future: Add more dashboard cards for sessions, attendance, etc. */}
    </div>
  );
}


