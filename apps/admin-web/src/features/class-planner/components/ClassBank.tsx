'use client';

import { useMemo } from 'react';
import { useClassPlan } from '../hooks/useClassPlansQuery';
import { Card } from '@altitutor/ui';
import { formatSubjectDisplay, getSubjectColorStyle } from '@/shared/utils';

interface ClassBankProps {
  planId: string;
}

export function ClassBank({ planId }: ClassBankProps) {
  const { data: plan } = useClassPlan(planId);

  // Get unassigned classes (no day_of_week or start_time/end_time)
  const unassignedClasses = useMemo(() => {
    if (!plan) return [];
    return plan.classes.filter(
      (cls) =>
        cls.day_of_week === null ||
        cls.start_time === null ||
        cls.end_time === null
    );
  }, [plan]);

  if (!plan) return null;

  return (
    <div className="p-4 h-full overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Class Bank (Unassigned)</h3>
        <span className="text-xs text-muted-foreground">
          {unassignedClasses.length} class{unassignedClasses.length !== 1 ? 'es' : ''}
        </span>
      </div>
      
      {unassignedClasses.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No unassigned classes. All classes have been assigned to time slots.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto">
          {unassignedClasses.map((cls) => {
            const subject = cls.subject;
            const { style, textColorClass } = subject
              ? getSubjectColorStyle(subject)
              : { style: {}, textColorClass: 'text-gray-800' };
            
            return (
              <Card
                key={cls.id}
                className="p-3 min-w-[200px] cursor-move hover:shadow-md transition-shadow"
                draggable
                style={style}
              >
                <div className={`font-medium text-sm ${textColorClass}`}>
                  {subject ? formatSubjectDisplay(subject) : 'No Subject'}
                </div>
                {cls.level && (
                  <div className="text-xs text-muted-foreground mt-1">{cls.level}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1">
                  {cls.students.length} student{cls.students.length !== 1 ? 's' : ''}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
