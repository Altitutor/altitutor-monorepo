'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle } from 'lucide-react';
import { calculateFirstSessionDate, calculateLastSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { formatDate, cn } from '@/shared/utils';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { subDays } from 'date-fns';
import { calculateSessionPrice, formatCurrency } from '@/shared/utils/pricing';
import { pricingApi } from '@/features/billing/api/pricing';
import { subjectPricingOverridesApi } from '@/features/billing/api/subject-pricing-overrides';
import { fetchStudentSubsidies } from '@/features/students/api/subsidies';
import { formatInvoiceDate, getInvoiceStatusBadge, toInvoiceStatusPayload } from '@/features/billing/utils/invoiceFormatters';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';

interface ChangeClassStep3SummaryProps {
  studentId: string;
  student: Tables<'students'>;
  oldClass: Tables<'classes'>;
  oldClassSubject?: Tables<'subjects'>;
  oldClassStaff?: Tables<'staff'>[];
  selectedNewClass?: ClassWithExpandedSubject;
  changeoverDate: string;
  timeOverlapWarning: string | null;
}

export function ChangeClassStep3Summary({
  studentId,
  student,
  oldClass,
  oldClassSubject,
  oldClassStaff: _oldClassStaff,
  selectedNewClass,
  changeoverDate,
  timeOverlapWarning,
}: ChangeClassStep3SummaryProps) {
  // Calculate session dates
  const lastSessionOldClass = oldClass && changeoverDate
    ? calculateLastSessionDate(oldClass, getMidnightAdelaide(new Date(changeoverDate)))
    : null;
  
  const firstSessionNewClass = selectedNewClass && changeoverDate && selectedNewClass.day_of_week !== undefined && selectedNewClass.start_time
    ? calculateFirstSessionDate(
        { day_of_week: selectedNewClass.day_of_week, start_time: selectedNewClass.start_time },
        getMidnightAdelaide(new Date(changeoverDate))
      )
    : null;

  // Calculate billing dates
  const lastBillingDateOldClass = lastSessionOldClass ? subDays(lastSessionOldClass, 1) : null;
  const firstBillingDateNewClass = firstSessionNewClass ? subDays(firstSessionNewClass, 1) : null;

  // Fetch the actual session for last session date (to get invoice info)
  const lastSessionDateStr = lastSessionOldClass ? lastSessionOldClass.toISOString().split('T')[0] : null;
  const { data: lastSessionData } = useQuery({
    queryKey: ['last-session-for-invoice', studentId, oldClass.id, lastSessionDateStr],
    queryFn: async () => {
      if (!lastSessionDateStr || !oldClass.id) return null;
      
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const startIso = new Date(`${lastSessionDateStr}T00:00:00`).toISOString();
      const endIso = new Date(`${lastSessionDateStr}T23:59:59`).toISOString();
      
      // Find session for this class on this date
      const { data: session, error } = await supabase
        .from('sessions')
        .select('id')
        .eq('class_id', oldClass.id)
        .gte('start_at', startIso)
        .lte('start_at', endIso)
        .maybeSingle();
      
      if (error || !session) return null;
      
      // Get sessions_students for this student
      const { data: sessionStudent, error: ssError } = await supabase
        .from('sessions_students')
        .select('id')
        .eq('session_id', session.id)
        .eq('student_id', studentId)
        .maybeSingle();
      
      if (ssError || !sessionStudent) return null;
      
      // Get invoice for this session_student
      const { data: invoiceItem, error: itemError } = await supabase
        .from('invoice_items')
        .select('invoice:invoices(*)')
        .eq('sessions_students_id', sessionStudent.id)
        .maybeSingle();
      
      if (itemError || !invoiceItem || !invoiceItem.invoice) return null;
      
      return invoiceItem.invoice as Tables<'invoices'>;
    },
    enabled: !!lastSessionDateStr && !!oldClass.id && !!studentId,
  });

  // Check if invoice date has passed
  const invoiceDateHasPassed = useMemo(() => {
    if (!lastSessionData?.invoice_date) return false;
    const invoiceDate = new Date(lastSessionData.invoice_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    invoiceDate.setHours(0, 0, 0, 0);
    return invoiceDate <= today;
  }, [lastSessionData]);

  // Fetch pricing data for first session billing amount calculation
  const { data: billingPricing = [] } = useQuery({
    queryKey: ['billing-pricing'],
    queryFn: () => pricingApi.getBillingPricing(),
    enabled: !!firstSessionNewClass && !!selectedNewClass,
  });

  const { data: pricingOverrides = [] } = useQuery({
    queryKey: ['subject-pricing-overrides'],
    queryFn: () => subjectPricingOverridesApi.getAllSubjectOverrides(),
    enabled: !!firstSessionNewClass && !!selectedNewClass,
  });

  const { data: subsidies = [] } = useQuery({
    queryKey: ['student-subsidies', studentId],
    queryFn: () => fetchStudentSubsidies(studentId),
    enabled: !!firstSessionNewClass && !!selectedNewClass && !!studentId,
  });

  // Calculate billing amount for first session
  const firstSessionBillingAmount = useMemo(() => {
    if (!firstSessionNewClass || !selectedNewClass || !selectedNewClass.subject_id || !selectedNewClass.start_time || !selectedNewClass.end_time) {
      return null;
    }

    if (!billingPricing.length) {
      return null;
    }

    const dateStr = firstSessionNewClass.toISOString().split('T')[0];
    const sessionStart = `${dateStr}T${selectedNewClass.start_time}:00`;
    const sessionEnd = `${dateStr}T${selectedNewClass.end_time}:00`;

    const mockSession = {
      billing_type: 'CLASS' as const,
      subject_id: selectedNewClass.subject_id,
      start_at: sessionStart,
      end_at: sessionEnd,
    };

    const pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }> = {};
    billingPricing.forEach(p => {
      pricingByBillingType[p.billing_type] = {
        hourly_rate_cents: p.hourly_rate_cents,
        currency: p.currency,
      };
    });

    const overridesBySubjectAndBilling: Record<string, Record<string, { hourly_rate_cents: number; currency: string }>> = {};
    pricingOverrides.forEach(override => {
      if (!overridesBySubjectAndBilling[override.subject_id]) {
        overridesBySubjectAndBilling[override.subject_id] = {};
      }
      overridesBySubjectAndBilling[override.subject_id][override.billing_type] = {
        hourly_rate_cents: override.hourly_rate_cents,
        currency: override.currency,
      };
    });

    const result = calculateSessionPrice(
      mockSession,
      studentId,
      firstSessionNewClass,
      pricingByBillingType,
      overridesBySubjectAndBilling,
      pricingOverrides,
      subsidies
    );

    return result;
  }, [firstSessionNewClass, selectedNewClass, billingPricing, pricingOverrides, subsidies, studentId]);

  // Get student name
  const studentName = `${student.first_name} ${student.last_name}`;

  // Get subject name
  const subjectName = oldClassSubject
    ? (oldClassSubject?.long_name ?? '')
    : 'choose subject';

  // Get old class name
  const oldClassName = oldClass && oldClassSubject
    ? (oldClass.long_name?.trim() ?? '')
    : 'choose class';

  // Get new class name
  const newClassName = selectedNewClass
    ? (selectedNewClass.long_name?.trim() ?? '')
    : 'choose class';

  // Format changeover date for display
  const changeoverDateDisplay = changeoverDate
    ? formatDate(new Date(changeoverDate))
    : 'choose date';

  return (
    <div className="space-y-4">
      {/* Info Card */}
      <div className="p-4 bg-muted rounded-lg">
        <p className="text-sm font-medium">
          Change{' '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {studentName}
          </span>
          {'\'s '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {subjectName}
          </span>
          {' class from '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {oldClassName}
          </span>
          {' to '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {newClassName}
          </span>
          {' starting on '}
          <span className={cn(
            "inline-flex items-center px-2 py-1 rounded-md font-semibold border",
            "bg-primary/10 text-primary border-primary/20"
          )}>
            {changeoverDateDisplay}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {lastSessionOldClass && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div>
              <p className="text-sm font-medium">Last Session (Old Class)</p>
              <p className="text-sm text-muted-foreground">
                {formatSessionDateTime(lastSessionOldClass)}
              </p>
            </div>
            
            {lastBillingDateOldClass && (
              <div>
                <p className="text-sm font-medium">Last Billing Date</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(lastBillingDateOldClass)}
                </p>
                
                {/* Show invoice details if invoice date has passed */}
                {invoiceDateHasPassed && lastSessionData ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">Status:</span>
                      {getInvoiceStatusBadge(toInvoiceStatusPayload(lastSessionData))}
                    </div>
                    {lastSessionData.invoice_date && (
                      <p className="text-xs text-muted-foreground">
                        Invoice Date: {formatInvoiceDate(lastSessionData.invoice_date)}
                      </p>
                    )}
                    {lastSessionData.created_at && (
                      <p className="text-xs text-muted-foreground">
                        Created: {formatDate(new Date(lastSessionData.created_at))}
                      </p>
                    )}
                    {lastSessionData.paid_at && (
                      <p className="text-xs text-muted-foreground">
                        Paid: {formatDate(new Date(lastSessionData.paid_at))}
                      </p>
                    )}
                    {lastSessionData.amount_due_cents !== null && (
                      <p className="text-xs font-medium">
                        Amount: {formatCurrency(lastSessionData.amount_due_cents, lastSessionData.currency || 'AUD')}
                      </p>
                    )}
                  </div>
                ) : lastBillingDateOldClass && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Invoice will be created on this date
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {firstSessionNewClass && (
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div>
              <p className="text-sm font-medium">First Session (New Class)</p>
              <p className="text-sm text-muted-foreground">
                {formatSessionDateTime(firstSessionNewClass)}
              </p>
            </div>
            
            {firstBillingDateNewClass && (
              <div>
                <p className="text-sm font-medium">First Billing Date</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(firstBillingDateNewClass)}
                </p>
                {firstSessionBillingAmount && (
                  <p className="text-sm font-medium mt-1">
                    {formatCurrency(firstSessionBillingAmount.amount_cents, firstSessionBillingAmount.currency)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warning */}
      {timeOverlapWarning && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{timeOverlapWarning}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

