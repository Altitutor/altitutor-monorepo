'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RichTextTemplatesTable } from '@/features/rich-text-templates/components/RichTextTemplatesTable';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@altitutor/ui';
import { AdminPageActionButton } from '@/shared/components';

export const dynamic = 'force-dynamic';

export default function RichTextTemplatesPage() {
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
            <h1 className="text-3xl font-bold tracking-tight">Rich Text Templates</h1>
          </div>
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="New Template"
            onClick={() => setCreateButtonClick((prev) => prev + 1)}
          />
        </div>
      </div>

      <RichTextTemplatesTable onCreateTrigger={createButtonClick} />
    </div>
  );
}
