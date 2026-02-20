import * as React from 'react';

export interface SessionInfoGridProps {
  /** Day display (e.g. "Friday 24/10/2025" or "—") */
  day: string;
  /** Time range display (e.g. "2:00 PM - 4:00 PM" or "—") */
  time: string;
  /** Subject cell content (e.g. Badge or "—") */
  subjectNode: React.ReactNode;
  /** Optional class row (e.g. link button or "—") */
  classNode?: React.ReactNode;
}

/**
 * Presentational grid for "Session Information" (Day, Time, Subject, optional Class).
 * Used in SessionDetailsTab and SessionModals across admin, student, and tutor apps.
 */
export function SessionInfoGrid({ day, time, subjectNode, classNode }: SessionInfoGridProps) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
      <div className="text-sm font-medium text-muted-foreground">Day:</div>
      <div className="text-sm">{day}</div>

      <div className="text-sm font-medium text-muted-foreground">Time:</div>
      <div className="text-sm">{time}</div>

      <div className="text-sm font-medium text-muted-foreground">Subject:</div>
      <div className="text-sm">{subjectNode}</div>

      {classNode !== undefined && (
        <>
          <div className="text-sm font-medium text-muted-foreground">Class:</div>
          <div className="text-sm">{classNode}</div>
        </>
      )}
    </div>
  );
}
