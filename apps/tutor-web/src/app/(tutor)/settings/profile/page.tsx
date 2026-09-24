'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Button,
  SkeletonFormFields,
  SkeletonPageHeader,
  SkeletonSegmentedTabs,
} from '@altitutor/ui';
import { useProfile } from '@/features/profile';
import { ChevronLeft } from 'lucide-react';
import { DetailsTab } from '@/features/profile/components/tabs/DetailsTab';
import { PublicProfileTab } from '@/features/profile/components/tabs/PublicProfileTab';
import { AvailabilityTab } from '@/features/profile/components/tabs/AvailabilityTab';
import { AccountTab } from '@/features/profile/components/tabs/AccountTab';
import { TutorPageContainer } from '@/shared/components/layouts';
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@/shared/components/segmented-tab-panel';

const VALID_TABS = ['details', 'public-profile', 'availability', 'account'] as const;
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
      <TutorPageContainer className="space-y-6">
        <SkeletonPageHeader showBack />
        <SkeletonSegmentedTabs />
        <SkeletonFormFields fields={6} columns={2} />
      </TutorPageContainer>
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
        </div>
      </header>

      <SegmentedTabPanel
        value={activeTab}
        onValueChange={handleTabChange}
        className="w-full"
        options={[
          { value: 'details', label: 'Details' },
          { value: 'public-profile', label: 'Public profile' },
          { value: 'availability', label: 'Availability' },
          { value: 'account', label: 'Account' },
        ]}
      >
        <SegmentedTabPanelContent when="details" activeTab={activeTab} className="mt-6">
          <DetailsTab profile={profile} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="public-profile" activeTab={activeTab} className="mt-6">
          <PublicProfileTab profile={profile} />
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
