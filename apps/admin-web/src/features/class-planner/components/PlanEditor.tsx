'use client';

import { useState, useEffect } from 'react';
import { useClassPlan } from '../hooks/useClassPlansQuery';
import { WeekCalendarView } from './WeekCalendarView';
import { StudentList } from './StudentList';
import { Button } from '@altitutor/ui';
import { Play, ArrowLeft } from 'lucide-react';
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
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [dragSubjectId, setDragSubjectId] = useState<string | null>(null);
  const [dragStudentSubjectId, setDragStudentSubjectId] = useState<string | null>(null);

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
        <div className="flex gap-2 mt-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.push('/settings')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button onClick={() => router.push('/settings/class-planner')}>
            Back to Plans
          </Button>
        </div>
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
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => router.push('/settings')}
            className="border"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => router.push('/settings/class-planner')}>
            Back to Plans
          </Button>
          {plan.status === 'DRAFT' && (
            <Button onClick={() => setShowApplyDialog(true)}>
              <Play className="h-4 w-4 mr-2" />
              Apply Plan
            </Button>
          )}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Split View: Calendar (75%) + Student List (25%) */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Calendar View */}
          <div className="flex-[3] border-r overflow-auto">
            <WeekCalendarView 
              plan={plan} 
              planId={planId}
              selectedSubjectId={selectedSubjectId}
              dragSubjectId={dragSubjectId || dragStudentSubjectId}
              onStudentDragStart={(subjectId) => {
                setDragStudentSubjectId(subjectId);
              }}
              onStudentDragEnd={() => {
                setDragStudentSubjectId(null);
              }}
            />
          </div>

          {/* Right: Student List */}
          <div className="flex-[1] overflow-auto">
            <StudentList 
              planId={planId}
              selectedSubjectId={selectedSubjectId}
              onSubjectFilterChange={setSelectedSubjectId}
              onDragStart={(subjectId) => {
                if (selectedSubjectId === null) {
                  setDragSubjectId(subjectId);
                }
              }}
              onDragEnd={() => {
                if (selectedSubjectId === null) {
                  setDragSubjectId(null);
                }
                setDragStudentSubjectId(null);
              }}
              onStudentDrop={() => {
                setDragStudentSubjectId(null);
              }}
            />
          </div>
        </div>
      </div>

      {/* Apply Dialog */}
      {showApplyDialog && currentStaff?.id && (
        <ApplyPlanDialog
          isOpen={showApplyDialog}
          onClose={() => {
            setShowApplyDialog(false);
            router.replace(`/settings/class-planner/${planId}`);
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
