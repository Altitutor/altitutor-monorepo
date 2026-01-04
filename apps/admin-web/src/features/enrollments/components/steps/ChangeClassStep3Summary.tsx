'use client';

import { Label } from '@altitutor/ui';
import { Alert, AlertDescription } from '@altitutor/ui';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { ClassCard } from '@/shared/components/ClassCard';
import { calculateFirstSessionDate, calculateLastSessionDate, formatSessionDateTime } from '@/shared/utils/schedule';
import { getMidnightAdelaide } from '@/shared/utils/enrollment';
import type { Tables, ClassWithExpandedSubject } from '@altitutor/shared';

interface ChangeClassStep3SummaryProps {
  oldClass: Tables<'classes'>;
  oldClassSubject?: Tables<'subjects'>;
  oldClassStaff?: Tables<'staff'>[];
  selectedNewClass?: ClassWithExpandedSubject;
  changeoverDate: string;
  timeOverlapWarning: string | null;
}

export function ChangeClassStep3Summary({
  oldClass,
  oldClassSubject,
  oldClassStaff,
  selectedNewClass,
  changeoverDate,
  timeOverlapWarning,
}: ChangeClassStep3SummaryProps) {
  // Calculate session dates
  const lastSessionOldClass = oldClass && changeoverDate
    ? calculateLastSessionDate(oldClass, getMidnightAdelaide(new Date(changeoverDate)))
    : null;
  
  const firstSessionNewClass = selectedNewClass && changeoverDate
    ? calculateFirstSessionDate(selectedNewClass, getMidnightAdelaide(new Date(changeoverDate)))
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">From</Label>
          <ClassCard
            class={oldClass}
            subject={oldClassSubject}
            staff={oldClassStaff || []}
          />
        </div>
        
        <ArrowRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
        
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">To</Label>
          {selectedNewClass && (
            <ClassCard
              class={selectedNewClass}
              subject={selectedNewClass.subject}
              staff={selectedNewClass.staff || []}
              students={selectedNewClass.students}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {lastSessionOldClass && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">Last Session (Old Class)</p>
            <p className="text-sm text-muted-foreground">
              {formatSessionDateTime(lastSessionOldClass)}
            </p>
          </div>
        )}

        {firstSessionNewClass && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium">First Session (New Class)</p>
            <p className="text-sm text-muted-foreground">
              {formatSessionDateTime(firstSessionNewClass)}
            </p>
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

