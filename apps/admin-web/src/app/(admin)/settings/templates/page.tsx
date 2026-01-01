'use client';

import { useRouter } from 'next/navigation';
import { TemplatesTable } from '@/features/messages/components/templates/TemplatesTable';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const router = useRouter();
  
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
      </div>
      
      <TemplatesTable />
    </div>
  );
}
