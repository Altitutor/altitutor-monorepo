'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input, Button } from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import type { Tables } from '@altitutor/shared';
import { studentsApi } from '@/features/students/api/students';
import { staffApi } from '@/features/staff/api/staff';
import { parentsApi } from '@/features/parents/api/parents';

export type MeetingEntityKind = 'student' | 'staff' | 'parent';

type BaseMeetingEntitySearchAddProps = {
  placeholder: string;
  existingIds: string[];
  disabled?: boolean;
};

export type MeetingEntitySearchAddProps =
  | (BaseMeetingEntitySearchAddProps & {
      kind: 'student';
      onPick: (row: Tables<'students'>) => Promise<void>;
    })
  | (BaseMeetingEntitySearchAddProps & {
      kind: 'staff';
      onPick: (row: Tables<'staff'>) => Promise<void>;
    })
  | (BaseMeetingEntitySearchAddProps & {
      kind: 'parent';
      onPick: (row: Tables<'parents'>) => Promise<void>;
    });

export function MeetingEntitySearchAdd(props: MeetingEntitySearchAddProps) {
  const { kind, placeholder, existingIds, onPick, disabled = false } = props;
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const excluded = new Set(existingIds);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['meeting-entity-search', kind, debounced],
    queryFn: async () => {
      if (kind === 'student') {
        const { students } = await studentsApi.listMinimal({
          search: debounced,
          statuses: ['ACTIVE', 'TRIAL'],
          limit: 20,
          offset: 0,
          orderBy: 'first_name',
          ascending: true,
        });
        return students as Tables<'students'>[];
      }
      if (kind === 'staff') {
        const { staff } = await staffApi.searchForAbsence({
          search: debounced,
          page: 0,
          pageSize: 20,
        });
        return staff as Tables<'staff'>[];
      }
      const { parents } = await parentsApi.list({
        search: debounced,
        limit: 20,
        offset: 0,
        orderBy: 'last_name',
        ascending: true,
      });
      return parents as Tables<'parents'>[];
    },
    enabled: open,
    staleTime: 20_000,
  });

  const label = (row: Tables<'students'> | Tables<'staff'> | Tables<'parents'>) =>
    `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();

  return (
    <div className="space-y-2 w-full max-w-sm">
      {!open ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)} disabled={disabled}>
          Add {kind === 'student' ? 'student' : kind === 'staff' ? 'staff' : 'parent'}
        </Button>
      ) : (
        <div className="space-y-2 border rounded-md p-2 bg-muted/30">
          <div className="relative">
            <Input
              placeholder={placeholder}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              disabled={disabled}
            />
            {isFetching && (
              <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
          <div className="max-h-40 overflow-y-auto text-sm space-y-0.5">
            {rows
              .filter((r) => !excluded.has(r.id))
              .map((r) => (
                <button
                  key={r.id}
                  type="button"
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-muted"
                  disabled={disabled}
                  onClick={async () => {
                    if (kind === 'student') {
                      await onPick(r as Tables<'students'>);
                    } else if (kind === 'staff') {
                      await onPick(r as Tables<'staff'>);
                    } else {
                      await onPick(r as Tables<'parents'>);
                    }
                    setQ('');
                    setOpen(false);
                  }}
                >
                  {label(r)}
                </button>
              ))}
            {!isFetching && rows.filter((r) => !excluded.has(r.id)).length === 0 && (
              <div className="text-muted-foreground text-xs px-2 py-2">No matches</div>
            )}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={disabled}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
