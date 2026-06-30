'use client';

import { useState } from 'react';
import { RichTextTemplatesTable } from '@/features/rich-text-templates/components/RichTextTemplatesTable';
import { Plus } from 'lucide-react';
import { AdminPageActionButton, SettingsPageHeader } from '@/shared/components';

export const dynamic = 'force-dynamic';

export default function RichTextTemplatesPage() {
  const [createButtonClick, setCreateButtonClick] = useState(0);

  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Rich Text Templates"
        actions={(
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            label="New Template"
            onClick={() => setCreateButtonClick((prev) => prev + 1)}
          />
        )}
      />

      <RichTextTemplatesTable onCreateTrigger={createButtonClick} />
    </div>
  );
}
