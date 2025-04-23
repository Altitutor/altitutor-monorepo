'use client';

import { StaffTable } from '@/components/staff/StaffTable';

export default function StaffPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Staff</h1>
      <StaffTable />
    </div>
  );
} 