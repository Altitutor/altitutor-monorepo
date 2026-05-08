'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SearchableSelect, Button } from '@altitutor/ui';
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

const ADD_LABEL: Record<MeetingEntityKind, string> = {
  student: 'Add student',
  staff: 'Add staff',
  parent: 'Add parent',
};

export function MeetingEntitySearchAdd(props: MeetingEntitySearchAddProps) {
  const { kind, placeholder, existingIds, onPick, disabled = false } = props;
  const [menuOpen, setMenuOpen] = useState(false);
  const [liveSearch, setLiveSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const excluded = new Set(existingIds);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(liveSearch), 300);
    return () => clearTimeout(t);
  }, [liveSearch]);

  useEffect(() => {
    if (!menuOpen) setLiveSearch('');
  }, [menuOpen]);

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
    enabled: menuOpen,
    staleTime: 20_000,
  });

  const label = (row: Tables<'students'> | Tables<'staff'> | Tables<'parents'>) =>
    `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();

  const filtered = rows.filter((r) => !excluded.has(r.id));

  const handlePick = async (item: Tables<'students'> | Tables<'staff'> | Tables<'parents'> | null) => {
    if (!item || disabled) return;
    if (kind === 'student') {
      await onPick(item as Tables<'students'>);
    } else if (kind === 'staff') {
      await onPick(item as Tables<'staff'>);
    } else {
      await onPick(item as Tables<'parents'>);
    }
  };

  return (
    <div className="inline-flex max-w-sm">
      <SearchableSelect
        open={menuOpen}
        onOpenChange={setMenuOpen}
        items={filtered}
        value={null}
        onValueChange={(v) => void handlePick(v)}
        getItemId={(r) => r.id}
        getItemLabel={label}
        onSearchChange={setLiveSearch}
        loading={isFetching}
        placeholder={ADD_LABEL[kind]}
        searchPlaceholder={placeholder}
        emptyMessage="No matches"
        disabled={disabled}
        showChevron={false}
        trigger={
          <Button type="button" size="sm" variant="outline" className="shrink-0" disabled={disabled}>
            {ADD_LABEL[kind]}
          </Button>
        }
        className="w-[min(100%,280px)]"
      />
    </div>
  );
}
