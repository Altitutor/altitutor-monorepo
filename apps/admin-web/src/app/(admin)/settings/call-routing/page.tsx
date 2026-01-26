'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CallRoutingRulesTable, OnCallSchedulesTable } from '@/features/call-routing';
import { callRoutingApi, type CallRoutingRule, type OnCallSchedule, type OwnedNumber } from '@/features/call-routing/api';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@altitutor/ui';

export default function CallRoutingPage() {
  const router = useRouter();
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
      <div className="flex items-center gap-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/settings')}
          className="border"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">Call Routing</h1>
          <p className="text-muted-foreground">
            Configure how incoming calls are routed based on business hours and on-call schedules. All times are in Adelaide timezone.
          </p>
        </div>
      </div>

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
