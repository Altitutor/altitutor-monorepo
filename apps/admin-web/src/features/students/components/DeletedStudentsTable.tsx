'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '@altitutor/ui';
import { studentsApi } from '../api';

export function DeletedStudentsTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['students', 'deleted', search, page],
    queryFn: () => studentsApi.listDeleted({ search, page }),
  });
  return <div className="space-y-4">
    <p className="text-sm text-muted-foreground">History is retained. Open a Student to review their record or restore access. Restoring does not restart ended services or reclaim released contact details.</p>
    <Input aria-label="Search deleted Students" placeholder="Search by name" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
    {error ? <p role="alert">Unable to load deleted Students. Please try again.</p> : <>
      <Table>
        <TableHeader><TableRow><TableHead>Student</TableHead><TableHead>Deleted</TableHead></TableRow></TableHeader>
        <TableBody>
          {data?.students.map(student => <TableRow key={student.id}>
            <TableCell><Link className="underline" href={`/students/${student.id}`}>{student.first_name} {student.last_name}</Link></TableCell>
            <TableCell>{student.deleted_at ? new Date(student.deleted_at).toLocaleString() : ''}</TableCell>
          </TableRow>)}
          {!data?.students.length && <TableRow><TableCell colSpan={2}>{isLoading ? 'Loading…' : 'No deleted Students found.'}</TableCell></TableRow>}
        </TableBody>
      </Table>
      <TablePagination page={page} pageSize={20} total={data?.total ?? 0} isFetching={isFetching} onPageChange={setPage} showPageSizeSelector={false} />
    </>}
  </div>;
}
