'use client';

import type { Tables } from '@altitutor/shared';
import { Switch } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useBillingPreferences } from '@/features/billing/hooks/useBillingPreferences';

interface BillingPreferencesSectionProps {
  student: Tables<'students'>;
}

export function BillingPreferencesSection({ student }: BillingPreferencesSectionProps) {
  const {
    preferences,
    isLoading: loading,
    isUpdating: saving,
    updatePreference,
  } = useBillingPreferences({ studentId: student.id });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold mb-4">Billing Preferences</h3>
        <p className="text-sm text-muted-foreground mb-6">
          Configure how invoices are processed and who receives invoice emails for this student.
        </p>
      </div>

      <div className="space-y-6">
        {/* Auto-bill toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5 flex-1">
            <Label htmlFor="auto_bill_enabled" className="text-base font-medium">
              Auto-bill when payment method available
            </Label>
            <p className="text-sm text-muted-foreground">
              If enabled, invoices will be automatically charged to the default payment method when available.
              If disabled, invoices will always be sent via email instead.
            </p>
          </div>
          <Switch
            id="auto_bill_enabled"
            checked={preferences.auto_bill_enabled}
            onCheckedChange={(checked) => updatePreference(student.id, 'auto_bill_enabled', checked)}
            disabled={saving}
          />
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="mb-2">
            <Label className="text-base font-medium">Invoice Email Recipients</Label>
            <p className="text-sm text-muted-foreground mt-1">
              Select who should receive invoice emails when invoices are sent (not auto-billed).
            </p>
          </div>

          {/* Student email toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="invoice_email_to_student" className="text-sm font-medium">
                Send to student email
              </Label>
              <p className="text-sm text-muted-foreground">
                {student.email ? `Send invoices to ${student.email}` : 'Student email not set'}
              </p>
            </div>
            <Switch
              id="invoice_email_to_student"
              checked={preferences.invoice_email_to_student}
              onCheckedChange={(checked) => updatePreference(student.id, 'invoice_email_to_student', checked)}
              disabled={saving || !student.email}
            />
          </div>

          {/* Parent emails toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="invoice_email_to_parents" className="text-sm font-medium">
                Send to parent email(s)
              </Label>
              <p className="text-sm text-muted-foreground">
                Send invoices to all linked parent email addresses
              </p>
            </div>
            <Switch
              id="invoice_email_to_parents"
              checked={preferences.invoice_email_to_parents}
              onCheckedChange={(checked) => updatePreference(student.id, 'invoice_email_to_parents', checked)}
              disabled={saving}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
