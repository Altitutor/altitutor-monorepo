'use client';

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { Sparkles } from 'lucide-react';
import { OPEN_WELCOME_MODAL_EVENT } from '@/features/welcome';

export default function SettingsPage() {
  const handleShowWelcomeModal = () => {
    window.dispatchEvent(new Event(OPEN_WELCOME_MODAL_EVENT));
  };

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your student portal preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome Modal</CardTitle>
          <CardDescription>Reopen the onboarding modal at any time.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleShowWelcomeModal}>
            <Sparkles className="mr-2 h-4 w-4" />
            Show Welcome Modal Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
