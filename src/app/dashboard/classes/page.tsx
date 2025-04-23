'use client';

import { ClassesTable } from '@/components/classes/ClassesTable';

export default function ClassesPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Classes</h1>
      <ClassesTable />
    </div>
  );
} 