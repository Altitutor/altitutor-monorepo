'use client';

import { useEffect, useState } from 'react';
import { CallRoutingRulesTable, OnCallSchedulesTable } from '@/features/call-routing';
import { callRoutingApi, type CallRoutingRule, type OnCallSchedule, type OwnedNumber } from '@/features/call-routing/api';
import { Loader2 } from 'lucide-react';
import { SettingsPageHeader } from '@/shared/components';

export default function CallRoutingPage() {
  const [rules, setRules] = useState<CallRoutingRule[]>([]);
  const [schedules, setSchedules] = useState<OnCallSchedule[]>([]);
  const [ownedNumbers, setOwnedNumbers] = useState<OwnedNumber[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesData, schedulesData, numbersData] = await Promise.all([
        callRoutingApi.getRoutingRules(),
        callRoutingApi.getOnCallSchedules(),
        callRoutingApi.getOwnedNumbers(),
      ]);
      setRules(rulesData);
      setSchedules(schedulesData);
      setOwnedNumbers(numbersData);
    } catch (error) {
      console.error('Failed to load call routing data:', error);
      alert('Failed to load call routing data: ' + (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6">
      <SettingsPageHeader title="Call Routing" />

      <CallRoutingRulesTable
        rules={rules}
        ownedNumbers={ownedNumbers}
        onUpdate={loadData}
      />

      <OnCallSchedulesTable
        schedules={schedules}
        onUpdate={loadData}
      />
    </div>
  );
}
