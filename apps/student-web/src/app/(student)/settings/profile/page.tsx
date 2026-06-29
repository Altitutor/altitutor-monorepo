'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  SegmentedTabPanel,
  SegmentedTabPanelContent,
  SkeletonFormFields,
  SkeletonPageHeader,
  SkeletonSegmentedTabs,
} from '@altitutor/ui';
import { useProfile } from '@/features/profile';
import { DetailsTab } from '@/features/profile/components/tabs/DetailsTab';
import { AvailabilityTab } from '@/features/profile/components/tabs/AvailabilityTab';
import { AccountTab } from '@/features/profile/components/tabs/AccountTab';
import { SettingsPageHeader } from '@/features/settings/components/SettingsPageHeader';
import { StudentPageContainer } from '@/shared/components/layouts';

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
      <StudentPageContainer className="space-y-6">
        <SkeletonPageHeader showBack />
        <SkeletonSegmentedTabs />
        <SkeletonFormFields fields={6} columns={2} />
      </StudentPageContainer>
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
    <StudentPageContainer className="space-y-6">
      <header className="space-y-4">
        <SettingsPageHeader
          title="My profile"
          description="Update your personal information and preferences"
          backHref="/settings"
          backLabel="All settings"
        />
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
    </StudentPageContainer>
  );
}
