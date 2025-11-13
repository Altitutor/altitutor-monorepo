'use client';

import { TemplatesTable } from '@/features/messages/components/templates/TemplatesTable';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
      </div>
      
      <TemplatesTable />
    </div>
  );
}

