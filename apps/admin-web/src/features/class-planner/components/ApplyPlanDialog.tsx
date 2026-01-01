'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle } from 'lucide-react';
import { useApplyClassPlan } from '../hooks/useClassPlansQuery';
import { useClassPlan } from '../hooks/useClassPlansQuery';
import { useToast } from '@altitutor/ui';
import { useRouter } from 'next/navigation';
import { format, endOfYear } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

interface ApplyPlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName: string;
  planYear: number;
  staffId: string;
}

export function ApplyPlanDialog({
  isOpen,
  onClose,
  planId,
  planName,
  planYear,
  staffId,
}: ApplyPlanDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: plan } = useClassPlan(planId);
  const applyMutation = useApplyClassPlan();
  
  // Default to today, end of year
  const today = new Date();
  const yearEnd = endOfYear(new Date(planYear, 0));
  
  const [sessionStartDate, setSessionStartDate] = useState<Date>(today);

  // Check for unassigned students_subjects - must be called before early return
  const { data: allStudentsWithSubjects } = useQuery({
    queryKey: ['class-planner', 'students-subjects', planId],
    queryFn: async () => {
      const supabase = (await import('@/shared/lib/supabase/client')).getSupabaseClient();
      const { data, error } = await supabase
        .from('students_subjects')
        .select(`
          student:students(*),
          subject:subjects(*)
        `);
      if (error) throw error;
      return (data || []).filter((row: any) => row.student && row.subject);
    },
    enabled: !!plan, // Only run query when plan exists
  });

  const handleApply = async () => {
    try {
      await applyMutation.mutateAsync({
        planId,
        sessionStartDate,
        staffId,
      });

      toast({
        title: 'Success',
        description: 'Class plan applied successfully. Classes have been created and sessions will be generated from the selected date onwards.',
      });

      onClose();
      router.push('/settings/class-planner');
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to apply class plan',
        variant: 'destructive',
      });
    }
  };

  if (!plan) return null;

  const totalClasses = plan.classes.length;
  const totalStudents = plan.classes.reduce((sum, cls) => sum + cls.students.length, 0);
  const totalStaff = plan.classes.reduce((sum, cls) => sum + cls.staff.length, 0);

  const assignedSet = new Set<string>();
  plan.classes.forEach((cls) => {
    cls.students.forEach((student) => {
      const key = `${student.id}-${cls.subject_id || 'null'}`;
      assignedSet.add(key);
    });
  });

  const unassignedCount = allStudentsWithSubjects?.filter((item: any) => {
    const key = `${item.student.id}-${item.subject.id}`;
    return !assignedSet.has(key);
  }).length || 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Apply Class Plan</DialogTitle>
          <DialogDescription>
            This will replace all existing classes for {planYear} and create new classes, enrollments, staff assignments, and sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action will delete all existing classes and cannot be undone. A backup will be created automatically. Classes will be applied immediately, and sessions will be generated from the selected date onwards.
            </AlertDescription>
          </Alert>

          {unassignedCount > 0 && (
            <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-600">
              <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              <AlertDescription className="text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> There {unassignedCount === 1 ? 'is' : 'are'} {unassignedCount} unassigned student-subject combination{unassignedCount !== 1 ? 's' : ''} that will not be included in this plan. You can proceed anyway.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label>Plan Summary</Label>
            <div className="text-sm space-y-1">
              <div>Plan: <strong>{planName}</strong></div>
              <div>Year: <strong>{planYear}</strong></div>
              <div>Classes: <strong>{totalClasses}</strong></div>
              <div>Student Enrollments: <strong>{totalStudents}</strong></div>
              <div>Staff Assignments: <strong>{totalStaff}</strong></div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="session-start-date">Start Creating Sessions From *</Label>
            <Input
              id="session-start-date"
              type="date"
              value={format(sessionStartDate, 'yyyy-MM-dd')}
              onChange={(e) => setSessionStartDate(new Date(e.target.value))}
              min={format(today, 'yyyy-MM-dd')}
              required
            />
            <p className="text-xs text-muted-foreground">
              Classes will be applied immediately. Sessions will be generated from this date until the end of {planYear}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={applyMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={applyMutation.isPending}
            variant="destructive"
          >
            {applyMutation.isPending ? 'Applying...' : 'Apply Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
