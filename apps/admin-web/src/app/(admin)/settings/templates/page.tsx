'use client';

import { useState } from 'react';
import { TemplatesTable } from '@/features/messages/components/templates/TemplatesTable';
import { Plus } from 'lucide-react';
import { AdminPageActionButton, SettingsPageHeader } from '@/shared/components';

export const dynamic = 'force-dynamic';

export default function TemplatesPage() {
  const [createButtonClick, setCreateButtonClick] = useState(0);
  
  return (
    <div className="p-6">
      <SettingsPageHeader
        title="Message Templates"
        actions={(
          <AdminPageActionButton
            icon={<Plus className="h-4 w-4" />}
            createShortcut
            label="Create template"
            onClick={() => setCreateButtonClick(prev => prev + 1)}
          />
        )}
      />
      
      <TemplatesTable onCreateTrigger={createButtonClick} />
    </div>
  );
}
