import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useTheme } from '@/hooks/use-theme';

export default function InvoiceViewerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { url } = useLocalSearchParams<{ url?: string }>();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Invoice',
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
          <Stack.Toolbar.Button accessibilityLabel="Close invoice" icon="xmark" onPress={() => router.back()} />
        </Stack.Toolbar>
      ) : null}
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        {url ? <WebView source={{ uri: url }} style={styles.webView} /> : null}
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
