'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@altitutor/ui';
import { ProfileForm } from '@/features/profile/components';

export default function MyProfilePage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground mt-1">
          Update your personal information and preferences
        </p>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>
            Keep your profile up to date to help us provide the best service
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm />
        </CardContent>
      </Card>
    </div>
  );
}

