'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@altitutor/ui';
import { useProfile } from '@/features/profile';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { DetailsTab } from '@/features/profile/components/tabs/DetailsTab';
import { AvailabilityTab } from '@/features/profile/components/tabs/AvailabilityTab';
import { AccountTab } from '@/features/profile/components/tabs/AccountTab';
import { TutorPageContainer } from '@/shared/components/layouts';
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel';

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

      <SegmentedTabPanel
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
        options={[
          { value: 'details', label: 'Details' },
          { value: 'availability', label: 'Availability' },
          { value: 'account', label: 'Account' },
        ]}
      >
        <SegmentedTabPanelContent when="details" activeTab={activeTab} className="mt-6">
          <DetailsTab profile={profile} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="availability" activeTab={activeTab} className="mt-6">
          <AvailabilityTab profile={profile} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="account" activeTab={activeTab} className="mt-6">
          <AccountTab profile={profile} />
        </SegmentedTabPanelContent>
      </SegmentedTabPanel>
    </TutorPageContainer>
  );
}
