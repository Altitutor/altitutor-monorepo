'use client';

import Link from 'next/link';
import { DeletedStudentsTable } from '@/features/students/components/DeletedStudentsTable';

export default function DeletedStudentsPage() {
  return <div className="space-y-6 p-6">
    <Link className="text-sm underline" href="/students">Back to Students</Link>
    <h1 className="text-3xl font-bold tracking-tight">Deleted Students</h1>
    <DeletedStudentsTable />
  </div>;
}
