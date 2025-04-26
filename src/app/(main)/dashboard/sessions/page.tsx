'use client';

import { SessionsTable } from '@/components/features/sessions';

export default function SessionsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Sessions</h1>
      <SessionsTable />
    </div>
  );
} 