'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Label } from '@altitutor/ui';
import { Loader2, Trash2 } from 'lucide-react';
import {
  ADMIN_SESSION_TYPES,
  STAFF_ATTENDANCE_TYPES,
  TEACHING_SESSION_TYPES,
  type StaffPayTierRequirementKind,
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

const TENURE_KINDS: StaffPayTierRequirementKind[] = ['TENURE_DAYS', 'TENURE_MONTHS'];

export function isTenureRequirementKind(kind: StaffPayTierRequirementKind): boolean {
  return TENURE_KINDS.includes(kind);
}

export function hasTenureRequirement(requirements: PayTierRequirementRow[]): boolean {
  return requirements.some((r) => isTenureRequirementKind(r.requirement_kind));
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
      <TenureRequirementEditor
        requirement={requirement}
        saving={saving}
        onSave={(min) =>
          updateRequirement.mutate({
            tierNumber,
            id: requirement.id,
            params: { min },
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

function TenureRequirementEditor({
  requirement,
  saving,
  onSave,
  onDelete,
}: {
  requirement: PayTierRequirementRow;
  saving: boolean;
  onSave: (min: number) => void;
  onDelete: () => void;
}) {
  const unit = requirement.requirement_kind === 'TENURE_MONTHS' ? 'months' : 'days';
  const initialMin = parseMinParam(requirement.params);
  const [min, setMin] = useState(String(initialMin));

  useEffect(() => {
    setMin(String(parseMinParam(requirement.params)));
  }, [requirement.id, requirement.params]);

  const commit = () => {
    const parsed = parseInt(min, 10);
    if (Number.isNaN(parsed) || parsed < 0) return;
    if (parsed !== parseMinParam(requirement.params)) {
      onSave(parsed);
    }
  };

  return (
    <li className="rounded-md border p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium capitalize">Tenure ({unit} employed)</p>
        <Button variant="ghost" size="icon" onClick={onDelete} disabled={saving}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-end gap-2 max-w-xs">
        <div className="flex-1 space-y-1">
          <Label htmlFor={`tenure-min-${requirement.id}`}>Minimum {unit}</Label>
          <Input
            id={`tenure-min-${requirement.id}`}
            type="number"
            min={0}
            step={1}
            value={min}
            onChange={(e) => setMin(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              }
            }}
          />
        </div>
        {saving && <Loader2 className="h-4 w-4 animate-spin mb-2 text-muted-foreground" />}
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

  const commit = () => {
    const parsedMin = parseInt(min, 10);
    if (Number.isNaN(parsedMin) || parsedMin < 0) return;
    if (sessionTypes.length === 0) return;

    const nextParams = {
      min: parsedMin,
      session_types: sessionTypes,
      attendance_types: attendanceTypes.length > 0 ? attendanceTypes : undefined,
    };
    const current = parseSessionParams(requirement.params);
    const unchanged =
      current.min === parsedMin &&
      arraysEqual(current.session_types, sessionTypes) &&
      arraysEqual(current.attendance_types, attendanceTypes);
    if (!unchanged) {
      onSave(nextParams);
    }
  };

  const toggle = (value: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  };

  return (
    <li className="rounded-md border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium">Session count</p>
        <Button variant="ghost" size="icon" onClick={onDelete} disabled={saving}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1 max-w-xs">
        <Label htmlFor={`sessions-min-${requirement.id}`}>Minimum sessions</Label>
        <Input
          id={`sessions-min-${requirement.id}`}
          type="number"
          min={0}
          step={1}
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
        />
      </div>

      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-muted-foreground">Session types</legend>
        <div className="flex flex-wrap gap-2">
          {allSessionTypes.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={sessionTypes.includes(type)}
                onChange={() => toggle(type, sessionTypes, setSessionTypes)}
                onBlur={commit}
              />
              {type.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-1">
        <legend className="text-xs font-medium text-muted-foreground">
          Attendance roles (optional — leave empty for any role)
        </legend>
        <div className="flex flex-wrap gap-2">
          {STAFF_ATTENDANCE_TYPES.map((type) => (
            <label key={type} className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={attendanceTypes.includes(type)}
                onChange={() => toggle(type, attendanceTypes, setAttendanceTypes)}
                onBlur={commit}
              />
              {type.replace(/_/g, ' ')}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={commit}>
          Apply session rule
        </Button>
        {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
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
