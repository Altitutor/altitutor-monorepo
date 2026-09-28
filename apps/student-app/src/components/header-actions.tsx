import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';

export function HeaderActions() {
  const router = useRouter();
  const theme = useTheme();
  const notifications = () => router.push('/notifications');
  const menu = () => router.push('/settings');

  if (process.env.EXPO_OS === 'ios') {
    return (
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="bell" accessibilityLabel="Notifications" onPress={withHaptic(notifications)} />
        <Stack.Toolbar.Button icon="line.3.horizontal" accessibilityLabel="Menu" onPress={withHaptic(menu)}>
          Menu
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  }

  const icon = (label: string, symbol: 'bell' | 'menu', action: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={withHaptic(action)} style={{ padding: 12 }}>
      <Image
        accessibilityIgnoresInvertColors
        source={{
          uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${theme.primary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${symbol === 'menu' ? '<path d="M4 6h16M4 12h16M4 18h16"/>' : '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>'}</svg>`)}`,
        }}
        style={{ width: 24, height: 24 }}
      />
    </Pressable>
  );

  return (
    <Stack.Screen
      options={{
        headerRight: () => (
          <View style={{ flexDirection: 'row' }}>
            {icon('Notifications', 'bell', notifications)}
            {icon('Menu', 'menu', menu)}
          </View>
        ),
      }}
    />
  );
}
