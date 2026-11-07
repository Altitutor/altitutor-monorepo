import { canPrintToOffice } from '@altitutor/shared';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyBlock, ErrorBlock, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import { getOfficePrintAvailability, getOfficePrintJob, queueOfficePrint } from '@/features/resources/office-print-api';
import { getResourceFile } from '@/features/resources/resources-api';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

const terminalStatuses = ['succeeded', 'failed', 'ambiguous', 'cancelled'];
const printTimeout = 120_000;

export default function OfficePrintScreen() {
  const { fileId } = useLocalSearchParams<{ fileId: string }>();
  const theme = useTheme();
  const { session } = useAuth();
  const [copies, setCopies] = useState(1);
  const [jobId, setJobId] = useState<string>();
  const [timedOut, setTimedOut] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    if (!jobId) return;
    const timer = setTimeout(() => setTimedOut(true), printTimeout);
    return () => clearTimeout(timer);
  }, [jobId]);

  const file = useQuery({ queryKey: ['tutor-resource-file', fileId], queryFn: () => getResourceFile(fileId) });
  const availability = useQuery({
    queryKey: ['tutor-office-print-availability'],
    queryFn: getOfficePrintAvailability,
  });
  const enqueue = useMutation({
    mutationFn: ({ storedFileId, count, userId }: { storedFileId: string; count: number; userId: string }) =>
      queueOfficePrint(storedFileId, count, userId),
    retry: false,
    onSuccess: setJobId,
    onSettled: () => { submitting.current = false; },
  });
  const status = useQuery({
    queryKey: ['tutor-office-print-job', jobId],
    queryFn: () => jobId ? getOfficePrintJob(jobId) : null,
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      if (timedOut) return false;
      return terminalStatuses.includes(query.state.data?.status ?? '') ? false : 2_000;
    },
    retry: false,
  });

  const available = availability.data;
  const blocked = available?.access === 'off' ? 'Office print is turned off for tutors.'
    : available?.online === false ? 'The office printer is offline.'
    : available?.access === 'office_hours' && !available.windowOpen ? 'Office print is available during an admin shift.'
    : undefined;
  const resource = file.data;
  const eligible = Boolean(resource && canPrintToOffice(resource));
  const busy = enqueue.isPending || Boolean(jobId);
  const canSubmit = Boolean(resource?.fileId && eligible && available && !availability.isError && !blocked && !busy);
  const statusCode = status.data?.status;
  const statusLabel = statusCode === 'succeeded' ? 'Sent to the office printer.'
    : statusCode === 'ambiguous' ? 'Printing may have started. Check the tray before trying again.'
    : statusCode === 'failed' || statusCode === 'cancelled' ? status.data?.error || 'The job did not finish.'
    : timedOut ? 'The result could not be confirmed. Check the printer tray.'
    : 'Queued for the office printer.';

  function submit() {
    if (!resource?.fileId || !session || !canSubmit || submitting.current) return;
    submitting.current = true;
    enqueue.mutate({ storedFileId: resource.fileId, count: copies, userId: session.user.id });
  }

  return (
    <TutorScreen title="Print to office" largeTitle={false} onRefresh={() => void availability.refetch()} refreshing={availability.isRefetching}>
      {file.isPending || availability.isPending ? <LoadingBlock label="Checking printer availability…" /> : null}
      {file.isError || availability.isError ? <ErrorBlock message={(file.error ?? availability.error)?.message ?? 'Could not check the printer.'} /> : null}
      {file.isSuccess && !eligible ? <EmptyBlock>This file cannot be printed to the office.</EmptyBlock> : null}
      {eligible && resource ? (
        <Card>
          <Text selectable style={{ color: theme.text, fontWeight: '600', fontSize: 17 }}>{resource.filename}</Text>
          <Text style={{ color: theme.textSecondary, lineHeight: 21 }}>
            FUJ office printer · Black and white, A4, double-sided, one staple at the top left.
          </Text>
          {jobId ? (
            <Text accessibilityLiveRegion="polite" selectable style={{ color: theme.text, fontSize: 16 }}>
              {statusLabel}
            </Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Text style={{ color: theme.text, fontSize: 16 }}>Copies</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <CopyButton label="Fewer copies" glyph="−" disabled={busy || copies <= 1} onPress={() => setCopies((value) => Math.max(1, value - 1))} />
                <Text accessibilityLiveRegion="polite" style={{ color: theme.text, fontSize: 17, fontVariant: ['tabular-nums'], minWidth: 26, textAlign: 'center' }}>{copies}</Text>
                <CopyButton label="More copies" glyph="+" disabled={busy || copies >= 20} onPress={() => setCopies((value) => Math.min(20, value + 1))} />
              </View>
            </View>
          )}
        </Card>
      ) : null}
      {blocked && !jobId ? <ErrorBlock message={blocked} /> : null}
      {enqueue.isError ? <ErrorBlock message={enqueue.error.message} /> : null}
      {eligible && !jobId ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit, busy: enqueue.isPending }}
          disabled={!canSubmit}
          onPress={submit}
          style={({ pressed }) => ({
            minHeight: 48,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: canSubmit ? theme.primary : theme.backgroundSelected,
            opacity: pressed ? 0.75 : 1,
            borderRadius: 14,
            borderCurve: 'continuous',
          })}
        >
          <Text style={{ color: canSubmit ? theme.onPrimary : theme.textSecondary, fontSize: 16, fontWeight: '600' }}>
            {enqueue.isPending ? 'Sending…' : 'Print to office'}
          </Text>
        </Pressable>
      ) : null}
    </TutorScreen>
  );
}

function CopyButton({ label, glyph, onPress, disabled }: { label: string; glyph: string; onPress: () => void; disabled: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 44,
        minWidth: 44,
        borderRadius: 12,
        backgroundColor: theme.backgroundSelected,
        opacity: pressed || disabled ? 0.5 : 1,
      })}
    >
      <Text style={{ color: theme.primary, fontSize: 21 }}>{glyph}</Text>
    </Pressable>
  );
}
