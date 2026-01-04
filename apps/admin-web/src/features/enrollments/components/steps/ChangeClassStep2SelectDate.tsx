'use client';

import { Input } from '@altitutor/ui';
import { Label } from '@altitutor/ui';
import { Calendar as CalendarIcon } from 'lucide-react';

interface ChangeClassStep2SelectDateProps {
  changeoverDate: string;
  onDateChange: (date: string) => void;
}

export function ChangeClassStep2SelectDate({
  changeoverDate,
  onDateChange,
}: ChangeClassStep2SelectDateProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="changeover-date">Changeover Date</Label>
        <div className="relative">
          <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="changeover-date"
            type="date"
            value={changeoverDate}
            onChange={(e) => onDateChange(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Student will be unenrolled from the old class and enrolled in the new class on this date
        </p>
      </div>
    </div>
  );
}

