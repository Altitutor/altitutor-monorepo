import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch, Text, View } from 'react-native';

import { Card, ErrorBlock, Label, LoadingBlock, TutorScreen } from '@/components/tutor-ui';
import {
  devicePushEnabled, disablePushNotifications, enablePushNotifications,
  getPushPreference, pushAvailable, setPushPreference,
} from '@/features/notifications/push-registration';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function PushSettingsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const queries = useQueryClient();
  const userId = session?.user.id;
  const queryKey = ['tutor-push-settings', userId];
  const settings = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async () => {
      const [enabled, device] = await Promise.all([getPushPreference(userId!), devicePushEnabled(userId!)]);
      return { enabled, device };
    },
  });
  const update = useMutation({
    mutationFn: ({ field, value }: { field: 'account' | 'device'; value: boolean }) => {
      if (field === 'account') return setPushPreference(userId!, value);
      return value ? enablePushNotifications(userId!) : disablePushNotifications(userId!);
    },
    onSettled: () => queries.invalidateQueries({ queryKey }),
  });

  return (
    <TutorScreen title="Notification settings" largeTitle={false}
      refreshing={settings.isRefetching} onRefresh={() => void settings.refetch()}>
      {settings.isPending ? <LoadingBlock label="Loading notification settings…" /> : null}
      {settings.error ? <ErrorBlock message={settings.error.message} /> : null}
      {settings.data ? (
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>Tutor updates</Text>
              <Label>Allow push alerts for updates in your tutor inbox.</Label>
            </View>
            <Switch accessibilityLabel="Tutor updates" disabled={update.isPending}
              value={settings.data.enabled} onValueChange={(value) => update.mutate({ field: 'account', value })} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.text, fontSize: 17, fontWeight: '600' }}>This device</Text>
              <Label>{pushAvailable ? 'Receive alerts on this device.' : 'Device alerts require a configured native Tutor build.'}</Label>
            </View>
            <Switch accessibilityLabel="Push alerts on this device" disabled={!pushAvailable || update.isPending}
              value={settings.data.device} onValueChange={(value) => update.mutate({ field: 'device', value })} />
          </View>
        </Card>
      ) : null}
      {update.error ? <ErrorBlock message={update.error.message} /> : null}
    </TutorScreen>
  );
}
