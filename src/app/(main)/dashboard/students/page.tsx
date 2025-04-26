'use client';

import { StudentsTable } from '@/components/features/students';

export default function StudentsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Students</h1>
      <StudentsTable />
    </div>
  );
} 