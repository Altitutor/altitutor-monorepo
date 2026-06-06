'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@altitutor/ui';
import { Loader2, Trash2 } from 'lucide-react';
import {
  ADMIN_SESSION_TYPES,
  formatPayTierSessionType,
  formatPayTierStaffAttendanceType,
  isTenureRequirementKind,
  parseTimeRequirementParams,
  resolveTimeUnit,
  STAFF_ATTENDANCE_TYPES,
  TEACHING_SESSION_TYPES,
  tenureKindForUnit,
  TIME_UNITS,
  type StaffPayTierRequirementKind,
  type TimeUnit,
} from '@altitutor/shared/pay-tiers';
import {
  useUpdatePayTierRequirement,
  useDeletePayTierRequirement,
} from '../hooks';

export type PayTierRequirementRow = {
  id: string;
  tier_number: number;
  requirement_kind: StaffPayTierRequirementKind;
  params: Record<string, unknown>;
  sort_order: number;
};

export function hasTenureRequirement(requirements: PayTierRequirementRow[]): boolean {
  return requirements.some((r) => isTenureRequirementKind(r.requirement_kind));
}

export function hasTimeSincePromotionRequirement(requirements: PayTierRequirementRow[]): boolean {
  return requirements.some((r) => r.requirement_kind === 'TIME_SINCE_LAST_PROMOTION');
}

type PayTierRequirementEditorProps = {
  tierNumber: number;
  requirement: PayTierRequirementRow;
};

export function PayTierRequirementEditor({ tierNumber, requirement }: PayTierRequirementEditorProps) {
  const updateRequirement = useUpdatePayTierRequirement();
  const deleteRequirement = useDeletePayTierRequirement();
  const saving = updateRequirement.isPending;

  if (isTenureRequirementKind(requirement.requirement_kind)) {
    return (
      <TimeRequirementEditor
        title="Tenure"
        description="Time employed at Altitutor"
        requirement={requirement}
        saving={saving}
        onSave={(params, kind) =>
          updateRequirement.mutate({
            tierNumber,
            id: requirement.id,
            params,
            requirement_kind: kind,
          })
        }
        onDelete={() =>
          deleteRequirement.mutate({ tierNumber, requirementId: requirement.id })
        }
      />
    );
  }

  if (requirement.requirement_kind === 'TIME_SINCE_LAST_PROMOTION') {
    return (
      <TimeRequirementEditor
        title="Time since last promotion"
        description="Measured from the last check-in that resulted in a promotion"
        requirement={requirement}
        saving={saving}
        onSave={(params) =>
          updateRequirement.mutate({
            tierNumber,
            id: requirement.id,
            params,
          })
        }
        onDelete={() =>
          deleteRequirement.mutate({ tierNumber, requirementId: requirement.id })
        }
      />
    );
  }

  return (
    <SessionCountRequirementEditor
      requirement={requirement}
      saving={saving}
      onSave={(params) =>
        updateRequirement.mutate({
          tierNumber,
          id: requirement.id,
          params,
        })
      }
      onDelete={() =>
        deleteRequirement.mutate({ tierNumber, requirementId: requirement.id })
      }
    />
  );
}

function TimeRequirementEditor({
  title,
  description,
  requirement,
  saving,
  onSave,
  onDelete,
}: {
  title: string;
  description: string;
  requirement: PayTierRequirementRow;
  saving: boolean;
  onSave: (params: { min: number; unit: TimeUnit }, kind?: StaffPayTierRequirementKind) => void;
  onDelete: () => void;
}) {
  const parsed = parseTimeRequirementParams(requirement.params);
  const initialUnit = resolveTimeUnit(requirement.requirement_kind, parsed);
  const [min, setMin] = useState(String(parsed.min));
  const [unit, setUnit] = useState<TimeUnit>(initialUnit);

  useEffect(() => {
    const next = parseTimeRequirementParams(requirement.params);
    setMin(String(next.min));
    setUnit(resolveTimeUnit(requirement.requirement_kind, next));
  }, [requirement.id, requirement.params, requirement.requirement_kind]);

  const commit = useCallback(
    (nextMin: string, nextUnit: TimeUnit) => {
      const parsedMin = parseInt(nextMin, 10);
      if (Number.isNaN(parsedMin) || parsedMin < 0) return;

      const params = { min: parsedMin, unit: nextUnit };
      const current = parseTimeRequirementParams(requirement.params);
      const currentUnit = resolveTimeUnit(requirement.requirement_kind, current);
      const unchanged = current.min === parsedMin && currentUnit === nextUnit;
      if (unchanged) return;

      if (isTenureRequirementKind(requirement.requirement_kind)) {
        onSave(params, tenureKindForUnit(nextUnit));
        return;
      }
      onSave(params);
    },
    [onSave, requirement.params, requirement.requirement_kind]
  );

  const handleMinBlur = () => commit(min, unit);
  const handleUnitChange = (nextUnit: TimeUnit) => {
    setUnit(nextUnit);
    commit(min, nextUnit);
  };

  return (
    <li className="rounded-md border p-4">
      <div className="flex items-start gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={onDelete} disabled={saving}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-end gap-2 shrink-0">
          <div className="space-y-1 w-24">
            <Label htmlFor={`time-min-${requirement.id}`} className="text-xs">
              Minimum
            </Label>
            <Input
              id={`time-min-${requirement.id}`}
              type="number"
              min={0}
              step={1}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              onBlur={handleMinBlur}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleMinBlur();
                }
              }}
            />
          </div>
          <div className="space-y-1 w-28">
            <Label htmlFor={`time-unit-${requirement.id}`} className="text-xs">
              Unit
            </Label>
            <Select value={unit} onValueChange={(v) => handleUnitChange(v as TimeUnit)}>
              <SelectTrigger id={`time-unit-${requirement.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_UNITS.map((u) => (
                  <SelectItem key={u} value={u}>
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {saving && <Loader2 className="h-4 w-4 animate-spin mb-2 text-muted-foreground shrink-0" />}
        </div>
      </div>
    </li>
  );
}

function SessionCountRequirementEditor({
  requirement,
  saving,
  onSave,
  onDelete,
}: {
  requirement: PayTierRequirementRow;
  saving: boolean;
  onSave: (params: Record<string, unknown>) => void;
  onDelete: () => void;
}) {
  const initial = useMemo(() => parseSessionParams(requirement.params), [requirement.params]);
  const [min, setMin] = useState(String(initial.min));
  const [sessionTypes, setSessionTypes] = useState<string[]>(initial.session_types);
  const [attendanceTypes, setAttendanceTypes] = useState<string[]>(initial.attendance_types);

  useEffect(() => {
    const next = parseSessionParams(requirement.params);
    setMin(String(next.min));
    setSessionTypes(next.session_types);
    setAttendanceTypes(next.attendance_types);
  }, [requirement.id, requirement.params]);

  const allSessionTypes = useMemo(
    () => [...TEACHING_SESSION_TYPES, ...ADMIN_SESSION_TYPES] as string[],
    []
  );

  const persist = useCallback(
    (
      nextMin: number,
      nextSessionTypes: string[],
      nextAttendanceTypes: string[]
    ) => {
      if (Number.isNaN(nextMin) || nextMin < 0) return;
      if (nextSessionTypes.length === 0) return;

      const nextParams = {
        min: nextMin,
        session_types: nextSessionTypes,
        attendance_types: nextAttendanceTypes.length > 0 ? nextAttendanceTypes : undefined,
      };
      const current = parseSessionParams(requirement.params);
      const unchanged =
        current.min === nextMin &&
        arraysEqual(current.session_types, nextSessionTypes) &&
        arraysEqual(current.attendance_types, nextAttendanceTypes);
      if (!unchanged) {
        onSave(nextParams);
      }
    },
    [onSave, requirement.params]
  );

  const commitMin = () => {
    const parsedMin = parseInt(min, 10);
    if (Number.isNaN(parsedMin) || parsedMin < 0) return;
    persist(parsedMin, sessionTypes, attendanceTypes);
  };

  const toggleSessionType = (value: string) => {
    const next = sessionTypes.includes(value)
      ? sessionTypes.filter((x) => x !== value)
      : [...sessionTypes, value];
    setSessionTypes(next);
    const parsedMin = parseInt(min, 10);
    if (!Number.isNaN(parsedMin) && parsedMin >= 0 && next.length > 0) {
      persist(parsedMin, next, attendanceTypes);
    }
  };

  const toggleAttendanceType = (value: string) => {
    const next = attendanceTypes.includes(value)
      ? attendanceTypes.filter((x) => x !== value)
      : [...attendanceTypes, value];
    setAttendanceTypes(next);
    const parsedMin = parseInt(min, 10);
    if (!Number.isNaN(parsedMin) && parsedMin >= 0 && sessionTypes.length > 0) {
      persist(parsedMin, sessionTypes, next);
    }
  };

  return (
    <li className="rounded-md border p-4">
      <div className="flex items-start gap-6">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium">Session count</p>
            <Button variant="ghost" size="icon" className="shrink-0 -mt-1" onClick={onDelete} disabled={saving}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-muted-foreground">Session types</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {allSessionTypes.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={sessionTypes.includes(type)}
                    onChange={() => toggleSessionType(type)}
                  />
                  {formatPayTierSessionType(type)}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-muted-foreground">
              Attendance roles (optional — leave empty for any role)
            </legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {STAFF_ATTENDANCE_TYPES.map((type) => (
                <label key={type} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={attendanceTypes.includes(type)}
                    onChange={() => toggleAttendanceType(type)}
                  />
                  {formatPayTierStaffAttendanceType(type)}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex items-end gap-2 shrink-0 w-40 pt-7">
          <div className="flex-1 space-y-1">
            <Label htmlFor={`sessions-min-${requirement.id}`} className="text-xs">
              Minimum sessions
            </Label>
            <Input
              id={`sessions-min-${requirement.id}`}
              type="number"
              min={0}
              step={1}
              value={min}
              onChange={(e) => setMin(e.target.value)}
              onBlur={commitMin}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  commitMin();
                }
              }}
            />
          </div>
          {saving && <Loader2 className="h-4 w-4 animate-spin mb-2 text-muted-foreground shrink-0" />}
        </div>
      </div>
    </li>
  );
}

function parseMinParam(params: Record<string, unknown>): number {
  const raw = params.min;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isNaN(n) ? 0 : Math.max(0, Math.floor(n));
}

function parseSessionParams(params: Record<string, unknown>): {
  min: number;
  session_types: string[];
  attendance_types: string[];
} {
  const min = parseMinParam(params);
  const session_types = Array.isArray(params.session_types)
    ? params.session_types.filter((x): x is string => typeof x === 'string')
    : ['CLASS'];
  const attendance_types = Array.isArray(params.attendance_types)
    ? params.attendance_types.filter((x): x is string => typeof x === 'string')
    : ['MAIN_TUTOR'];
  return { min, session_types, attendance_types };
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((v, i) => v === sortedB[i]);
}
