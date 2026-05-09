'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { Sparkles } from 'lucide-react';
import { OPEN_WELCOME_MODAL_EVENT } from '@/features/welcome';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentBtnPrimary, studentCardCn } from '@/shared/lib/student-visual';

export default function SettingsPage() {
  const handleShowWelcomeModal = () => {
    window.dispatchEvent(new Event(OPEN_WELCOME_MODAL_EVENT));
  };

  return (
    <StudentPageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">Manage your student portal preferences.</p>
      </div>

      <Card className={studentCardCn()}>
        <CardHeader>
          <CardTitle>Welcome Modal</CardTitle>
          <CardDescription>Reopen the onboarding modal at any time.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className={studentBtnPrimary} onClick={handleShowWelcomeModal}>
            <Sparkles className="mr-2 h-4 w-4" />
            Show Welcome Modal Again
          </Button>
        </CardContent>
      </Card>
    </StudentPageContainer>
  );
}
