'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TemplatesTable } from '@/features/messages/components/templates/TemplatesTable';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@altitutor/ui';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const router = useRouter();
  const [createButtonClick, setCreateButtonClick] = useState(0);
  
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
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Message Templates</h1>
            <p className="text-muted-foreground">
              Create and manage message templates
            </p>
          </div>
          <Button onClick={() => setCreateButtonClick(prev => prev + 1)}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>
      
      <TemplatesTable onCreateTrigger={createButtonClick} />
    </div>
  );
}
