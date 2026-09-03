'use client';

import {
  Button,
  Input,
  Label,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SmartDatePickerField,
} from '@altitutor/ui';
import { Plus, Trash2 } from 'lucide-react';
import {
  formatPayTierResourceType,
  formatPayTierSessionType,
  formatPayTierStaffAttendanceType,
  STAFF_ATTENDANCE_TYPES,
} from '@altitutor/shared/pay-tiers';
import { useSubjects } from '@/features/subjects';
import {
  getTimeOverrideOptions,
  newResourceOverrideRow,
  newSessionOverrideRow,
  newTimeOverrideRow,
  OVERRIDE_SESSION_TYPES,
  PAY_TIER_RESOURCE_OVERRIDE_TYPES,
  type ResourceOverrideRow,
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
  resourceRows: ResourceOverrideRow[];
  onResourceRowsChange: (rows: ResourceOverrideRow[]) => void;
};

export function PayTiersStaffOverridesTab({
  employmentDate,
  onEmploymentDateChange,
  sessionRows,
  onSessionRowsChange,
  timeRows,
  onTimeRowsChange,
  resourceRows,
  onResourceRowsChange,
}: PayTiersStaffOverridesTabProps) {
  const timeOptions = getTimeOverrideOptions();
  const subjectsQuery = useSubjects();
  const subjects = subjectsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="employment-start">Employment start date</Label>
        <p className="text-xs text-muted-foreground">Controls tenure-based tier requirements.</p>
        <SmartDatePickerField
          value={employmentDate}
          onChange={(value) => onEmploymentDateChange(value ?? '')}
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
                      onTimeRowsChange(timeRows.map((r) => (r.id === row.id ? { ...r, metricKey: v } : r)))
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
                        timeRows.map((r) => (r.id === row.id ? { ...r, count: Number.isNaN(n) ? 0 : n } : r))
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
            <p className="text-xs text-muted-foreground">Add extra attended sessions toward tier metrics (additive).</p>
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
                        sessionRows.map((r) =>
                          r.id === row.id
                            ? {
                                ...r,
                                sessionType: v,
                                attendanceType: v === 'HOMEWORK_HELP' ? '' : r.attendanceType,
                              }
                            : r
                        )
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
                    disabled={row.sessionType === 'HOMEWORK_HELP'}
                    onValueChange={(v) =>
                      onSessionRowsChange(
                        sessionRows.map((r) => (r.id === row.id ? { ...r, attendanceType: v === 'any' ? '' : v } : r))
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
                        sessionRows.map((r) => (r.id === row.id ? { ...r, count: Number.isNaN(n) ? 0 : n } : r))
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

      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">Resource metric overrides</p>
            <p className="text-xs text-muted-foreground">
              Add resources created before database tracking began. Unknown types count only toward all-resource
              requirements.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => onResourceRowsChange([...resourceRows, newResourceOverrideRow()])}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add override
          </Button>
        </div>

        {resourceRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No resource overrides.</p>
        ) : (
          <ul className="space-y-3">
            {resourceRows.map((row) => {
              const selectedSubject = subjects.find((subject) => subject.id === row.subjectId) ?? null;
              return (
                <li key={row.id} className="flex flex-wrap items-end gap-2 rounded-md border p-3">
                  <div className="space-y-1 min-w-[170px]">
                    <Label className="text-xs">Resource type</Label>
                    <Select
                      value={row.resourceType}
                      onValueChange={(value) =>
                        onResourceRowsChange(
                          resourceRows.map((resourceRow) =>
                            resourceRow.id === row.id ? { ...resourceRow, resourceType: value } : resourceRow
                          )
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAY_TIER_RESOURCE_OVERRIDE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {formatPayTierResourceType(type)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 min-w-[240px] flex-1">
                    <Label className="text-xs">Subject (optional)</Label>
                    <SearchableSelect
                      items={subjects}
                      value={selectedSubject}
                      onValueChange={(subject) =>
                        onResourceRowsChange(
                          resourceRows.map((resourceRow) =>
                            resourceRow.id === row.id
                              ? {
                                  ...resourceRow,
                                  subjectId: subject?.id ?? null,
                                }
                              : resourceRow
                          )
                        )
                      }
                      getItemId={(subject) => subject.id}
                      getItemLabel={(subject) => subject.long_name ?? subject.short_name ?? subject.name}
                      getItemValue={(subject) =>
                        [subject.short_name, subject.long_name, subject.name].filter(Boolean).join(' ')
                      }
                      placeholder="Unknown subject"
                      clearLabel="Unknown subject"
                      searchPlaceholder="Search subjects..."
                      loading={subjectsQuery.isLoading}
                      allowClear
                      fullWidth
                    />
                  </div>
                  <div className="space-y-1 w-24">
                    <Label className="text-xs">Extra count</Label>
                    <Input
                      type="number"
                      min={0}
                      value={row.count}
                      onChange={(event) => {
                        const count = parseInt(event.target.value, 10);
                        onResourceRowsChange(
                          resourceRows.map((resourceRow) =>
                            resourceRow.id === row.id
                              ? {
                                  ...resourceRow,
                                  count: Number.isNaN(count) ? 0 : count,
                                }
                              : resourceRow
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
                    onClick={() =>
                      onResourceRowsChange(resourceRows.filter((resourceRow) => resourceRow.id !== row.id))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
