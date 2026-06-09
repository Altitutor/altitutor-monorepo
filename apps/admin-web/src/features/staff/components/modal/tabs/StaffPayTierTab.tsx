'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  SegmentedTabPanel,
  SegmentedTabPanelContent,
} from '@altitutor/ui';
import { Loader2 } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { usePayTierStaffProgress, useUpdateStaffTierProfile } from '@/features/pay-tiers/hooks';
import {
  buildMetricOverridesFromUi,
  sessionOverridesToRows,
  timeOverridesToRows,
  type SessionOverrideRow,
  type TimeOverrideRow,
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
  const [timeRows, setTimeRows] = useState<TimeOverrideRow[]>([]);

  useEffect(() => {
    if (!progress) return;
    setEmploymentDate(progress.employmentStartedAt.slice(0, 10));
    setSessionRows(sessionOverridesToRows(progress.metricOverrides));
    setTimeRows(timeOverridesToRows(progress.metricOverrides));
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
          metric_overrides: buildMetricOverridesFromUi(sessionRows, timeRows),
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
      <SegmentedTabPanel
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
        options={[
          { value: 'progress', label: 'Progress' },
          { value: 'check-ins', label: 'Check ins' },
          { value: 'overrides', label: 'Overrides' },
        ]}
      >
        <SegmentedTabPanelContent when="progress" activeTab={activeTab} className="mt-4">
          <PayTiersStaffProgressTab progress={progress} />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="check-ins" activeTab={activeTab} className="mt-4">
          <PayTiersStaffCheckInsTab
            staffId={staffId}
            staffFirstName={staffFirstName}
            staffLastName={staffLastName}
            progress={progress}
            onOpenSession={onOpenSession}
          />
        </SegmentedTabPanelContent>

        <SegmentedTabPanelContent when="overrides" activeTab={activeTab} className="mt-4 space-y-4">
          <PayTiersStaffOverridesTab
            employmentDate={employmentDate}
            onEmploymentDateChange={setEmploymentDate}
            sessionRows={sessionRows}
            onSessionRowsChange={setSessionRows}
            timeRows={timeRows}
            onTimeRowsChange={setTimeRows}
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
        </SegmentedTabPanelContent>
      </SegmentedTabPanel>
    </div>
  );
}
