'use client';

import { Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Plus, Trash2 } from 'lucide-react';
import {
  formatPayTierSessionType,
  formatPayTierStaffAttendanceType,
  STAFF_ATTENDANCE_TYPES,
} from '@altitutor/shared/pay-tiers';
import {
  getTimeOverrideOptions,
  newSessionOverrideRow,
  newTimeOverrideRow,
  OVERRIDE_SESSION_TYPES,
  type SessionOverrideRow,
  type TimeOverrideRow,
} from '../../utils/metricOverrides';

type PayTiersStaffOverridesTabProps = {
  employmentDate: string;
  onEmploymentDateChange: (value: string) => void;
  sessionRows: SessionOverrideRow[];
  onSessionRowsChange: (rows: SessionOverrideRow[]) => void;
  timeRows: TimeOverrideRow[];
  onTimeRowsChange: (rows: TimeOverrideRow[]) => void;
};

export function PayTiersStaffOverridesTab({
  employmentDate,
  onEmploymentDateChange,
  sessionRows,
  onSessionRowsChange,
  timeRows,
  onTimeRowsChange,
}: PayTiersStaffOverridesTabProps) {
  const timeOptions = getTimeOverrideOptions();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="employment-start">Employment start date</Label>
        <p className="text-xs text-muted-foreground">
          Controls tenure-based tier requirements.
        </p>
        <Input
          id="employment-start"
          type="date"
          value={employmentDate}
          onChange={(e) => onEmploymentDateChange(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Time metric overrides</p>
            <p className="text-xs text-muted-foreground">
              Add extra days, weeks, or months toward tenure or time-since-promotion requirements (additive).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onTimeRowsChange([...timeRows, newTimeOverrideRow()])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add override
          </Button>
        </div>

        {timeRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time overrides.</p>
        ) : (
          <ul className="space-y-3">
            {timeRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                <div className="space-y-1 min-w-[220px] flex-1">
                  <Label className="text-xs">Metric</Label>
                  <Select
                    value={row.metricKey}
                    onValueChange={(v) =>
                      onTimeRowsChange(
                        timeRows.map((r) => (r.id === row.id ? { ...r, metricKey: v } : r))
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeOptions.map((option) => (
                        <SelectItem key={option.metricKey} value={option.metricKey}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-24">
                  <Label className="text-xs">Extra count</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.count}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      onTimeRowsChange(
                        timeRows.map((r) =>
                          r.id === row.id ? { ...r, count: Number.isNaN(n) ? 0 : n } : r
                        )
                      );
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="mb-0.5"
                  onClick={() => onTimeRowsChange(timeRows.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Session metric overrides</p>
            <p className="text-xs text-muted-foreground">
              Add extra attended sessions toward tier metrics (additive).
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onSessionRowsChange([...sessionRows, newSessionOverrideRow()])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add override
          </Button>
        </div>

        {sessionRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No session overrides.</p>
        ) : (
          <ul className="space-y-3">
            {sessionRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-xs">Session type</Label>
                  <Select
                    value={row.sessionType}
                    onValueChange={(v) =>
                      onSessionRowsChange(
                        sessionRows.map((r) => (r.id === row.id ? { ...r, sessionType: v } : r))
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OVERRIDE_SESSION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {formatPayTierSessionType(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 min-w-[140px]">
                  <Label className="text-xs">Attendance role</Label>
                  <Select
                    value={row.attendanceType || 'any'}
                    onValueChange={(v) =>
                      onSessionRowsChange(
                        sessionRows.map((r) =>
                          r.id === row.id ? { ...r, attendanceType: v === 'any' ? '' : v } : r
                        )
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any role</SelectItem>
                      {STAFF_ATTENDANCE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {formatPayTierStaffAttendanceType(t)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 w-24">
                  <Label className="text-xs">Extra count</Label>
                  <Input
                    type="number"
                    min={0}
                    value={row.count}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10);
                      onSessionRowsChange(
                        sessionRows.map((r) =>
                          r.id === row.id ? { ...r, count: Number.isNaN(n) ? 0 : n } : r
                        )
                      );
                    }}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  className="mb-0.5"
                  onClick={() => onSessionRowsChange(sessionRows.filter((r) => r.id !== row.id))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
