import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth-provider';

export default function BillingManagementScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const billingUrl = `${process.env.EXPO_PUBLIC_STUDENT_WEB_URL ?? 'https://students.altitutor.com'}/auth/mobile-session`;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Manage billing',
          headerLargeTitleEnabled: false,
          headerTintColor: theme.primary,
          ...(Platform.OS === 'android'
            ? {
                headerRight: () => (
                  <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.closeAction}>
                    <Text style={[styles.closeText, { color: theme.primary }]}>Close</Text>
                  </Pressable>
                ),
              }
            : {}),
        }}
      />
      {Platform.OS === 'ios' ? (
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button accessibilityLabel="Close billing" icon="xmark" onPress={() => router.back()} />
        </Stack.Toolbar>
      ) : null}
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {session ? (
          <WebView
            source={{
              uri: billingUrl,
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                'X-Student-Refresh-Token': session.refresh_token,
              },
            }}
            style={styles.webView}
            contentInsetAdjustmentBehavior="never"
          />
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webView: { flex: 1 },
  closeAction: { paddingHorizontal: 8, paddingVertical: 8 },
  closeText: { fontSize: 16, fontWeight: '600' },
});
