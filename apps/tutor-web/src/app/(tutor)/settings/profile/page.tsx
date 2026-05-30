'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger, Button } from '@altitutor/ui';
import { useProfile } from '@/features/profile';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { DetailsTab } from '@/features/profile/components/tabs/DetailsTab';
import { AvailabilityTab } from '@/features/profile/components/tabs/AvailabilityTab';
import { AccountTab } from '@/features/profile/components/tabs/AccountTab';
import { TutorPageContainer } from '@/shared/components/layouts';
import { tutorTabsList, tutorTabsTrigger } from '@/shared/lib/tutor-visual';

const VALID_TABS = ['details', 'availability', 'account'] as const;
type TabValue = (typeof VALID_TABS)[number];

export default function SettingsProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabFromQuery = searchParams.get('tab') as TabValue | null;
  const initialTab = tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : 'details';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  const handleTabChange = (value: string) => {
    const newTab = value as TabValue;
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === 'details') {
      params.delete('tab');
    } else {
      params.set('tab', newTab);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const tabFromQuery = searchParams.get('tab') as TabValue | null;
    const validTab = tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : 'details';
    setActiveTab(validTab);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile) {
    return (
      <TutorPageContainer>
        <p className="text-muted-foreground">Profile not found</p>
      </TutorPageContainer>
    );
  }

  return (
    <TutorPageContainer className="space-y-6">
      <header className="space-y-4">
        <Button asChild variant="outline" size="sm" className="w-fit rounded-xl shadow-sm">
          <Link href="/settings" className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Settings
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My profile</h1>
          <p className="mt-1 text-muted-foreground">
            Update your personal information and preferences
          </p>
        </div>
      </header>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={tutorTabsList}>
          <TabsTrigger value="details" className={tutorTabsTrigger}>
            Details
          </TabsTrigger>
          <TabsTrigger value="availability" className={tutorTabsTrigger}>
            Availability
          </TabsTrigger>
          <TabsTrigger value="account" className={tutorTabsTrigger}>
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-6">
          <DetailsTab profile={profile} />
        </TabsContent>

        <TabsContent value="availability" className="mt-6">
          <AvailabilityTab profile={profile} />
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <AccountTab profile={profile} />
        </TabsContent>
      </Tabs>
    </TutorPageContainer>
  );
}
