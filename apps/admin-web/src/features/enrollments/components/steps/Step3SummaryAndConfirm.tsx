'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle } from 'lucide-react';
import { StudentCard } from '@/shared/components/StudentCard';
import { ClassCard } from '@/shared/components/ClassCard';
import { calculateFirstSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import { subDays, isBefore, startOfDay } from 'date-fns';
import { formatDate } from '@/shared/utils/datetime';
import { calculateSessionPrice, formatCurrency } from '@/shared/utils/pricing';
import { pricingApi } from '@/features/billing/api/pricing';
import { subjectPricingOverridesApi } from '@/features/billing/api/subject-pricing-overrides';
import { fetchStudentSubsidies } from '@/features/students/api/subsidies';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';
import type { EnrollmentContext, EnrollmentConflicts, StudentWithEnrollmentInfo } from '../../types/enrollment';

interface Step3SummaryAndConfirmProps {
  context: EnrollmentContext;
  selectedStudent?: StudentWithEnrollmentInfo | Tables<'students'>;
  selectedClass?: ClassWithExpandedSubject;
  studentSubjects?: Tables<'subjects'>[];
  enrollmentDate: string;
  conflicts: EnrollmentConflicts;
}

export function Step3SummaryAndConfirm({
  context: _context,
  selectedStudent,
  selectedClass,
  studentSubjects,
  enrollmentDate,
  conflicts,
}: Step3SummaryAndConfirmProps) {
  // Calculate first session date
  const firstSessionDate = selectedClass && enrollmentDate && selectedClass.day_of_week !== undefined && selectedClass.start_time
    ? calculateFirstSessionDate(
        { day_of_week: selectedClass.day_of_week, start_time: selectedClass.start_time },
        getMidnightAdelaide(new Date(enrollmentDate))
      )
    : null;
  
  // Calculate first billing date (day before first session)
  const firstBillingDate = firstSessionDate ? subDays(firstSessionDate, 1) : null;
  
  // Check if first billing date is in the past
  const isBillingDateInPast = firstBillingDate ? isBefore(startOfDay(firstBillingDate), startOfDay(new Date())) : false;

  // Fetch pricing data for billing amount calculation
  const { data: billingPricing = [] } = useQuery({
    queryKey: ['billing-pricing'],
    queryFn: () => pricingApi.getBillingPricing(),
    enabled: !!firstSessionDate && !!selectedClass,
  });

  const { data: pricingOverrides = [] } = useQuery({
    queryKey: ['subject-pricing-overrides'],
    queryFn: () => subjectPricingOverridesApi.getAllSubjectOverrides(),
    enabled: !!firstSessionDate && !!selectedClass,
  });

  const studentId = selectedStudent?.id;
  const { data: subsidies = [] } = useQuery({
    queryKey: ['student-subsidies', studentId],
    queryFn: () => fetchStudentSubsidies(studentId!),
    enabled: !!firstSessionDate && !!selectedClass && !!studentId,
  });

  // Calculate billing amount
  const billingAmount = useMemo(() => {
    if (!firstSessionDate || !selectedClass || !selectedClass.subject_id || !selectedClass.start_time || !selectedClass.end_time) {
      return null;
    }

    if (!billingPricing.length) {
      // Still loading pricing data or no pricing configured
      return null;
    }

    // Create a mock session object for the first session
    // Format: YYYY-MM-DDTHH:MM:SS (Adelaide local time, will be parsed correctly)
    const dateStr = firstSessionDate.toISOString().split('T')[0]; // Get YYYY-MM-DD
    const sessionStart = `${dateStr}T${selectedClass.start_time}:00`;
    const sessionEnd = `${dateStr}T${selectedClass.end_time}:00`;

    const mockSession = {
      billing_type: 'CLASS' as const, // Classes always have CLASS billing type
      subject_id: selectedClass.subject_id,
      start_at: sessionStart,
      end_at: sessionEnd,
    };

    // Build pricing lookup
    const pricingByBillingType: Record<string, { hourly_rate_cents: number; currency: string }> = {};
    billingPricing.forEach(p => {
      pricingByBillingType[p.billing_type] = {
        hourly_rate_cents: p.hourly_rate_cents,
        currency: p.currency,
      };
    });

    // Build overrides lookup
    const overridesBySubjectAndBilling: Record<string, Record<string, any>> = {};
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
      firstSessionDate,
      pricingByBillingType,
      overridesBySubjectAndBilling,
      pricingOverrides,
      subsidies
    );

    return result;
  }, [firstSessionDate, selectedClass, billingPricing, pricingOverrides, subsidies, studentId]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {selectedStudent && (
          <div>
            <StudentCard
              student={selectedStudent as Tables<'students'>}
              subjects={('subjects' in selectedStudent ? (selectedStudent as any).subjects : studentSubjects) || []}
              showSubjects={true}
            />
          </div>
        )}

        {selectedClass && (
          <div>
            <ClassCard
              class={selectedClass}
              subject={selectedClass.subject}
              staff={selectedClass.staff || []}
              students={selectedClass.students || []}
            />
          </div>
        )}

        {firstSessionDate && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">First Session</p>
            <p className="text-sm text-muted-foreground">
              {formatSessionDateTime(firstSessionDate)}
            </p>
          </div>
        )}

        {firstBillingDate && (
          <div className={`p-3 rounded-lg ${isBillingDateInPast ? 'bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800' : 'bg-muted'}`}>
            <p className="text-sm font-medium">First Billing Date</p>
            <p className="text-sm text-muted-foreground">
              {formatDate(firstBillingDate)}
            </p>
            {billingAmount && (
              <p className="text-sm font-medium mt-1">
                {formatCurrency(billingAmount.amount_cents, billingAmount.currency)}
              </p>
            )}
            {isBillingDateInPast && (
              <div className="mt-2 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
                <p className="text-xs text-orange-800 dark:text-orange-200">
                  This session will need to be invoiced manually as the billing date is in the past.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Warnings */}
      {(conflicts.sameSubjectWarning || conflicts.timeOverlapWarnings.length > 0) && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {conflicts.sameSubjectWarning && (
              <p className="font-medium">{conflicts.sameSubjectWarning}</p>
            )}
            {conflicts.timeOverlapWarnings.map((warning, i) => (
              <p key={i} className="text-sm">{warning}</p>
            ))}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

