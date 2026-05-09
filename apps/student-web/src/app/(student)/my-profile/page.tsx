'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { useProfile } from '@/features/profile';
import { Loader2 } from 'lucide-react';
import { DetailsTab } from '@/features/profile/components/tabs/DetailsTab';
import { AvailabilityTab } from '@/features/profile/components/tabs/AvailabilityTab';
import { AccountTab } from '@/features/profile/components/tabs/AccountTab';
import { StudentPageContainer } from '@/shared/components/layouts';
import { studentTabsList, studentTabsTrigger } from '@/shared/lib/student-visual';

const VALID_TABS = ['details', 'availability', 'account'] as const;
type TabValue = typeof VALID_TABS[number];

export default function MyProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // Get tab from query params, default to 'details'
  const tabFromQuery = searchParams.get('tab') as TabValue | null;
  const initialTab = tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : 'details';
  const [activeTab, setActiveTab] = useState<TabValue>(initialTab);

  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    const newTab = value as TabValue;
    setActiveTab(newTab);
    const params = new URLSearchParams(searchParams.toString());
    if (newTab === 'details') {
      params.delete('tab'); // Remove param for default tab
    } else {
      params.set('tab', newTab);
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // Sync with URL on mount/query param change
  useEffect(() => {
    const tabFromQuery = searchParams.get('tab') as TabValue | null;
    const validTab = tabFromQuery && VALID_TABS.includes(tabFromQuery) ? tabFromQuery : 'details';
    setActiveTab(validTab);
  }, [searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-dvh">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <StudentPageContainer>
        <p className="text-muted-foreground">Profile not found</p>
      </StudentPageContainer>
    );
  }

  return (
    <StudentPageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          Update your personal information and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={studentTabsList}>
          <TabsTrigger className={studentTabsTrigger} value="details">
            Details
          </TabsTrigger>
          <TabsTrigger className={studentTabsTrigger} value="availability">
            Availability
          </TabsTrigger>
          <TabsTrigger className={studentTabsTrigger} value="account">
            Account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-8">
          <DetailsTab profile={profile} />
        </TabsContent>

        <TabsContent value="availability" className="mt-8">
          <AvailabilityTab profile={profile} />
        </TabsContent>

        <TabsContent value="account" className="mt-8">
          <AccountTab profile={profile} />
        </TabsContent>
      </Tabs>
    </StudentPageContainer>
  );
}
