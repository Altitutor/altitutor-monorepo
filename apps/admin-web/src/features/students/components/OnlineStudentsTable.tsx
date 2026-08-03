'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  DataTableToolbar,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TablePagination,
  TableRow,
} from '@altitutor/ui';
import type {
  DataTableColumnDefinition,
  DataTableFilterDefinition,
  DataTableSortOption,
} from '@altitutor/shared';
import { ONLINE_PRODUCT_NAMES } from '@altitutor/shared';
import { Loader2 } from 'lucide-react';
import { useOnlineStudentsMinimal } from '../hooks/useStudentsQuery';
import { useDataTable } from '@/shared/hooks/useDataTable';
import { SettingsTableActions } from '@/shared/components';
import { ViewStudentModal } from './ViewStudentModal';
import type { StudentSearchField } from '../api/students';

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export function OnlineStudentsTable() {
  const defaultFilters = useMemo(() => ({}), []);
  const defaultSort = useMemo(() => ({ field: 'last_name', direction: 'asc' as const }), []);
  const defaultVisibleColumns = useMemo(() => ['student', 'products', 'online_since'], []);
  const {
    state,
    setSearch,
    setSort,
    setFilters,
    setPage,
    setPageSize,
    setVisibleColumns,
    applyQuickFilter,
    resetFilters,
  } = useDataTable({
    defaultFilters,
    defaultSort,
    defaultVisibleColumns,
    filterKeys: ['product', 'entitlement'],
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchFields, setSearchFields] = useState<StudentSearchField[]>(['name', 'email', 'phone']);

  const { data, isLoading, isFetching, error, refetch } = useOnlineStudentsMinimal({
    search: state.search,
    searchFields,
    products: state.filters.product as string[] | undefined,
    entitlements: state.filters.entitlement as string[] | undefined,
    page: state.page,
    pageSize: state.pageSize,
    orderBy: (state.sortBy || 'last_name') as 'first_name' | 'last_name' | 'online_since',
    ascending: state.sortDirection === 'asc',
  });

  const filterDefinitions: DataTableFilterDefinition[] = useMemo(() => [
    {
      key: 'product',
      label: 'Product',
      options: [
        { label: ONLINE_PRODUCT_NAMES.UCAT_WEB, value: 'UCAT_WEB' },
        { label: ONLINE_PRODUCT_NAMES.STUDENT_WEB, value: 'STUDENT_WEB' },
      ],
    },
    {
      key: 'entitlement',
      label: 'Tier',
      options: [
        { label: 'Free', value: 'FREE' },
        { label: 'Unlimited', value: 'PAID' },
      ],
    },
  ], []);

  const sortOptions: DataTableSortOption[] = [
    { key: 'first_name', label: 'First name' },
    { key: 'last_name', label: 'Last name' },
    { key: 'online_since', label: 'Online since' },
  ];
  const columnDefinitions: DataTableColumnDefinition[] = [
    { key: 'student', label: 'Student' },
    { key: 'products', label: 'Products' },
    { key: 'online_since', label: 'Online since' },
  ];

  const students = data?.students ?? [];
  const total = data?.total ?? 0;
  const openStudent = (studentId: string) => setSelectedStudentId(studentId);

  return (
    <div className="space-y-4">
      <DataTableToolbar
        state={state}
        onSearchChange={setSearch}
        onFiltersChange={setFilters}
        onSortChange={setSort}
        onGroupByChange={() => {}}
        onVisibleColumnsChange={setVisibleColumns}
        onQuickFilterApply={applyQuickFilter}
        onReset={resetFilters}
        filterDefinitions={filterDefinitions}
        sortOptions={sortOptions}
        columnDefinitions={columnDefinitions}
        quickFilters={[]}
        searchPlaceholder="Search name, email or phone..."
        searchFromOptions={[
          { label: 'Name', value: 'name' },
          { label: 'Email', value: 'email' },
          { label: 'Phone', value: 'phone' },
        ]}
        searchFromValue={searchFields}
        onSearchFromChange={(values) => setSearchFields(values as StudentSearchField[])}
        isLoading={isFetching}
      />

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Failed to load online students.
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-md border">
          {isFetching && !isLoading ? (
            <Loader2 className="absolute right-14 top-3 h-4 w-4 animate-spin text-muted-foreground" />
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                {state.visibleColumns.includes('student') ? <TableHead>Student</TableHead> : null}
                {state.visibleColumns.includes('products') ? <TableHead>Products</TableHead> : null}
                {state.visibleColumns.includes('online_since') ? <TableHead>Online since</TableHead> : null}
                <TableHead className="w-14" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={state.visibleColumns.length + 1} className="h-28 text-center text-muted-foreground">
                    Loading online students…
                  </TableCell>
                </TableRow>
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={state.visibleColumns.length + 1} className="h-28 text-center text-muted-foreground">
                    No online students match these filters.
                  </TableCell>
                </TableRow>
              ) : students.map((student) => {
                const name = `${student.first_name ?? ''} ${student.last_name ?? ''}`.trim();
                return (
                  <TableRow
                    key={student.id}
                    className="cursor-pointer"
                    onClick={() => openStudent(student.id)}
                  >
                    {state.visibleColumns.includes('student') ? (
                      <TableCell>
                        <div className="font-medium">{name || 'Unnamed Student'}</div>
                        {(student.email || student.phone) ? (
                          <div className="text-xs text-muted-foreground">
                            {[student.email, student.phone].filter(Boolean).join(' · ')}
                          </div>
                        ) : null}
                      </TableCell>
                    ) : null}
                    {state.visibleColumns.includes('products') ? (
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {student.products.map((relationship) => {
                            const tier = relationship.tier ?? (student.entitlement === 'PAID' ? 'UNLIMITED' : 'FREE');
                            return (
                              <Badge key={relationship.product} variant={tier === 'UNLIMITED' ? 'default' : 'secondary'}>
                                {ONLINE_PRODUCT_NAMES[relationship.product]} · {tier === 'UNLIMITED' ? 'Unlimited' : 'Free'}
                              </Badge>
                            );
                          })}
                        </div>
                      </TableCell>
                    ) : null}
                    {state.visibleColumns.includes('online_since') ? (
                      <TableCell>{formatDate(student.online_since)}</TableCell>
                    ) : null}
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      <SettingsTableActions
                        className="flex justify-end"
                        actions={[{
                          id: 'view-student',
                          label: 'View student',
                          onSelect: () => openStudent(student.id),
                        }]}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <TablePagination
        page={state.page}
        pageSize={state.pageSize}
        total={total}
        isFetching={isFetching}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <ViewStudentModal
        isOpen={selectedStudentId !== null}
        onClose={() => setSelectedStudentId(null)}
        studentId={selectedStudentId}
        onStudentUpdated={() => void refetch()}
        defaultTab="online"
      />
    </div>
  );
}
