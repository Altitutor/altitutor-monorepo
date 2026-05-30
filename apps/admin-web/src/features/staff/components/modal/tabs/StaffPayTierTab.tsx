'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { cn } from '@/shared/utils';
import { usePayTierStaffProgress, useUpdateStaffTierProfile } from '@/features/pay-tiers/hooks';
import {
  buildMetricOverridesFromUi,
  sessionOverridesToRows,
  type SessionOverrideRow,
} from '@/features/pay-tiers/utils/metricOverrides';
import { PayTiersStaffProgressTab } from '@/features/pay-tiers/components/staff-dialog/PayTiersStaffProgressTab';
import { PayTiersStaffCheckInsTab } from '@/features/pay-tiers/components/staff-dialog/PayTiersStaffCheckInsTab';
import { PayTiersStaffOverridesTab } from '@/features/pay-tiers/components/staff-dialog/PayTiersStaffOverridesTab';

type StaffPayTierTabProps = {
  staffId: string;
  staffFirstName: string | null;
  staffLastName: string | null;
  onOpenSession: (sessionId: string) => void;
};

export function StaffPayTierTab({
  staffId,
  staffFirstName,
  staffLastName,
  onOpenSession,
}: StaffPayTierTabProps) {
  const { toast } = useToast();
  const { data: progress, isLoading, isError, error } = usePayTierStaffProgress(staffId);
  const updateProfile = useUpdateStaffTierProfile();

  const [activeTab, setActiveTab] = useState('progress');
  const [employmentDate, setEmploymentDate] = useState('');
  const [sessionRows, setSessionRows] = useState<SessionOverrideRow[]>([]);

  useEffect(() => {
    if (!progress) return;
    setEmploymentDate(progress.employmentStartedAt.slice(0, 10));
    setSessionRows(sessionOverridesToRows(progress.metricOverrides));
  }, [progress]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (isError || !progress) {
    return (
      <p className="text-sm text-destructive py-4">
        {error instanceof Error ? error.message : 'Failed to load pay tier'}
      </p>
    );
  }

  const handleSaveOverrides = async () => {
    try {
      await updateProfile.mutateAsync({
        staffId,
        updates: {
          employment_started_at: new Date(employmentDate).toISOString(),
          metric_overrides: buildMetricOverridesFromUi(sessionRows),
        },
      });
      toast({ title: 'Overrides saved' });
    } catch (e) {
      toast({
        title: 'Save failed',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="check-ins">Check ins</TabsTrigger>
          <TabsTrigger value="overrides">Overrides</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className={cn('mt-4', activeTab !== 'progress' && 'hidden')}>
          <PayTiersStaffProgressTab progress={progress} />
        </TabsContent>

        <TabsContent value="check-ins" className={cn('mt-4', activeTab !== 'check-ins' && 'hidden')}>
          <PayTiersStaffCheckInsTab
            staffId={staffId}
            staffFirstName={staffFirstName}
            staffLastName={staffLastName}
            progress={progress}
            onOpenSession={onOpenSession}
          />
        </TabsContent>

        <TabsContent value="overrides" className={cn('mt-4 space-y-4', activeTab !== 'overrides' && 'hidden')}>
          <PayTiersStaffOverridesTab
            employmentDate={employmentDate}
            onEmploymentDateChange={setEmploymentDate}
            sessionRows={sessionRows}
            onSessionRowsChange={setSessionRows}
          />
          <div className="flex justify-end border-t pt-4">
            <Button disabled={updateProfile.isPending} onClick={handleSaveOverrides}>
              {updateProfile.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                'Save overrides'
              )}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
