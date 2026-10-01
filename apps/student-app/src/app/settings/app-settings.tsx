import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Label, StudentScreen } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushPreferences,
  pushEnabledOnDevice,
  setPushPreference,
} from '@/lib/notifications';
import { useThemePreference, type ThemePreference } from '@/providers/theme-preference-provider';

const modes: ThemePreference[] = ['light', 'dark', 'system'];

export default function AppSettingsScreen() {
  const theme = useTheme();
  const { preference, resolvedScheme, setPreference } = useThemePreference();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPending, setPushPending] = useState(false);
  const [categoryPending, setCategoryPending] = useState<string | null>(null);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const preferences = useQuery({ queryKey: ['student-push-preferences'], queryFn: getPushPreferences });

  useEffect(() => {
    void pushEnabledOnDevice().then(setPushEnabled);
  }, []);

  async function toggleNotifications(enabled: boolean) {
    setPushPending(true);
    setNotificationMessage(null);
    try {
      if (enabled) await enablePushNotifications();
      else await disablePushNotifications();
      setPushEnabled(enabled);
      setNotificationMessage(enabled
        ? 'Notifications enabled on this device.'
        : 'Notifications disabled on this device.');
    } catch (cause) {
      setNotificationMessage(cause instanceof Error ? cause.message : 'Unable to update notifications.');
    } finally {
      setPushPending(false);
    }
  }

  async function toggleCategory(category: 'sessions' | 'payments', enabled: boolean) {
    setCategoryPending(category);
    setNotificationMessage(null);
    try {
      await setPushPreference(category, enabled);
      await queryClient.invalidateQueries({ queryKey: ['student-push-preferences'] });
    } catch (cause) {
      setNotificationMessage(cause instanceof Error ? cause.message : 'Unable to update notification preferences.');
    } finally {
      setCategoryPending(null);
    }
  }

  return (
    <StudentScreen title="App settings">
      <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>APPEARANCE</Text>
      <Card>
        <Text style={[styles.rowTitle, { color: theme.text }]}>Theme</Text>
        <SegmentedControl
          values={['Light', 'Dark', 'System']}
          selectedIndex={modes.indexOf(preference)}
          appearance={resolvedScheme}
          onValueChange={(value) => setPreference(value.toLowerCase() as ThemePreference)}
        />
      </Card>
      <Text style={[styles.groupLabel, { color: theme.textSecondary }]}>NOTIFICATIONS</Text>
      <Card>
        <View style={styles.settingRow}>
          <Text style={[styles.rowTitle, { color: theme.text }]}>Push notifications</Text>
          <Switch value={pushEnabled} onValueChange={(value) => void toggleNotifications(value)}
            disabled={pushPending || Platform.OS === 'web'} trackColor={{ true: theme.accent }} />
        </View>
        <Label>Choose which updates can reach this device. Categories sync across your devices.</Label>
        {(['sessions', 'payments'] as const).map((category) => (
          <View key={category} style={styles.settingRow}>
            <Text style={[styles.rowTitle, { color: theme.text }]}>
              {category === 'sessions' ? 'Sessions' : 'Payments'}
            </Text>
            <Switch value={preferences.data?.[category] ?? true}
              onValueChange={(value) => void toggleCategory(category, value)}
              disabled={preferences.isPending || categoryPending !== null}
              trackColor={{ true: theme.accent }} />
          </View>
        ))}
        {preferences.error ? <Label>Unable to load notification categories.</Label> : null}
        {notificationMessage ? <Label>{notificationMessage}</Label> : null}
      </Card>
    </StudentScreen>
  );
}

const styles = StyleSheet.create({
  groupLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 4, marginTop: 8 },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  settingRow: { minHeight: 38, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
