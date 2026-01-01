'use client';

import { useState, useEffect } from 'react';
import { useClassPlan } from '../hooks/useClassPlansQuery';
import { WeekCalendarView } from './WeekCalendarView';
import { StudentList } from './StudentList';
import { ClassBank } from './ClassBank';
import { Button } from '@altitutor/ui';
import { Save, Play } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { ApplyPlanDialog } from './ApplyPlanDialog';

interface PlanEditorProps {
  planId: string;
}

export function PlanEditor({ planId }: PlanEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: plan, isLoading, error } = useClassPlan(planId);
  const { data: currentStaff } = useCurrentStaff();
  const [showApplyDialog, setShowApplyDialog] = useState(false);

  useEffect(() => {
    if (searchParams.get('apply') === 'true') {
      setShowApplyDialog(true);
    }
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">Loading plan...</div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="p-6">
        <div className="text-red-500">Failed to load plan. Please try again.</div>
        <Button onClick={() => router.push('/class-planner')} className="mt-4">
          Back to Plans
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-var(--navbar-height))] flex flex-col">
      {/* Header */}
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{plan.name}</h1>
          <p className="text-sm text-muted-foreground">Year {plan.year}</p>
        </div>
        <div className="flex items-center gap-2">
          {plan.status === 'DRAFT' && (
            <Button onClick={() => setShowApplyDialog(true)}>
              <Play className="h-4 w-4 mr-2" />
              Apply Plan
            </Button>
          )}
          <Button variant="outline" onClick={() => router.push('/class-planner')}>
            Back to Plans
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Split View: Calendar (60%) + Student List (40%) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Calendar View */}
          <div className="flex-[3] border-r overflow-auto">
            <WeekCalendarView plan={plan} />
          </div>

          {/* Right: Student List */}
          <div className="flex-[2] overflow-auto">
            <StudentList planId={planId} />
          </div>
        </div>

        {/* Bottom: Class Bank */}
        <div className="border-t h-32 overflow-auto">
          <ClassBank planId={planId} />
        </div>
      </div>

      {/* Apply Dialog */}
      {showApplyDialog && currentStaff?.id && (
        <ApplyPlanDialog
          isOpen={showApplyDialog}
          onClose={() => {
            setShowApplyDialog(false);
            router.replace(`/class-planner/${planId}`);
          }}
          planId={planId}
          planName={plan.name}
          planYear={plan.year}
          staffId={currentStaff.id}
        />
      )}
    </div>
  );
}
