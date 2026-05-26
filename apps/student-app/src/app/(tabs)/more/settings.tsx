import SegmentedControl from '@expo/ui/community/segmented-control';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { Card, Label, StudentScreen } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';
import { enablePushNotifications } from '@/lib/notifications';
import { useThemePreference, type ThemePreference } from '@/providers/theme-preference-provider';

const modes: ThemePreference[] = ['light', 'dark', 'system'];

export default function SettingsScreen() {
  const theme = useTheme();
  const { preference, resolvedScheme, setPreference } = useThemePreference();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null);

  async function toggleNotifications(enabled: boolean) {
    setPushEnabled(enabled);
    setNotificationMessage(null);
    if (!enabled) return;
    try {
      await enablePushNotifications();
      setNotificationMessage('Notifications enabled on this device.');
    } catch (cause) {
      setPushEnabled(false);
      setNotificationMessage(cause instanceof Error ? cause.message : 'Unable to enable notifications.');
    }
  }

  return (
    <StudentScreen title="Settings" subtitle="Preferences for this device.">
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
          <Switch value={pushEnabled} onValueChange={toggleNotifications} trackColor={{ true: theme.accent }} />
        </View>
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
