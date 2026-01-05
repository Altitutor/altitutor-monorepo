'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@altitutor/ui';
import { useProfile } from '@/features/profile';
import { Loader2 } from 'lucide-react';
import { DetailsTab } from '@/features/profile/components/tabs/DetailsTab';
import { AvailabilityTab } from '@/features/profile/components/tabs/AvailabilityTab';
import { AccountTab } from '@/features/profile/components/tabs/AccountTab';

export default function MyProfilePage() {
  const { data: profile, isLoading } = useProfile();
  const [activeTab, setActiveTab] = useState('details');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          Update your personal information and preferences
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
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
    </div>
  );
}

