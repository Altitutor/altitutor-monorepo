'use client';

import { Button } from '@altitutor/ui';
import { Sparkles } from 'lucide-react';
import { OPEN_WELCOME_MODAL_EVENT } from '@/features/welcome';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentBtnPrimary, studentCardCn } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';
import { SettingsPageHeader } from './SettingsPageHeader';
import { SettingsRow } from './SettingsRow';

export function SettingsAppPage() {
  const handleShowWelcomeModal = () => {
    window.dispatchEvent(new Event(OPEN_WELCOME_MODAL_EVENT));
  };

  return (
    <StudentPageContainer className="space-y-6">
      <SettingsPageHeader
        title="App settings"
        description="Onboarding and portal preferences"
        backHref="/settings"
        backLabel="All settings"
      />

      <div className={cn(studentCardCn(), 'p-6 sm:p-8')}>
        <SettingsRow
          title="Welcome modal"
          description="Reopen the onboarding modal at any time."
          control={
            <Button className={studentBtnPrimary} onClick={handleShowWelcomeModal}>
              <Sparkles className="mr-2 h-4 w-4" />
              Show again
            </Button>
          }
        />
      </div>
    </StudentPageContainer>
  );
}
