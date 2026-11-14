import { Image } from 'expo-image';
import { useRouter, type NativeStackNavigationOptions } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';

type ViewMenu = { label: string; selected: boolean; onPress: () => void }[];
const paths = {
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
};

export function useHeaderActions(viewMenu?: ViewMenu): NativeStackNavigationOptions {
  const router = useRouter();
  const theme = useTheme();
  const notifications = withHaptic(() => router.push('/notifications'));
  const menu = withHaptic(() => router.push('/settings'));

  if (process.env.EXPO_OS === 'ios') {
    return {
      unstable_headerRightItems: () => [
        { type: 'button', label: 'Menu', icon: { type: 'sfSymbol', name: 'line.3.horizontal' }, onPress: menu },
        { type: 'button', label: 'Notifications', icon: { type: 'sfSymbol', name: 'bell' }, onPress: notifications },
        ...(viewMenu ? [{
          type: 'menu' as const,
          label: 'Calendar view',
          icon: { type: 'sfSymbol' as const, name: 'calendar' as const },
          menu: {
            items: viewMenu.map((item) => ({
              type: 'action' as const,
              label: item.label,
              state: item.selected ? 'on' as const : 'off' as const,
              onPress: withHaptic(item.onPress),
            })),
          },
        }] : []),
      ],
    };
  }

  const icon = (label: string, symbol: keyof typeof paths, action: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={action}
      style={({ pressed }) => ({ padding: 12, opacity: pressed ? 0.6 : 1 })}>
      <Image accessibilityIgnoresInvertColors
        source={{ uri: `data:image/svg+xml;base64,${btoa(
          `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${theme.primary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[symbol]}</svg>`,
        )}` }} style={{ width: 24, height: 24 }} />
    </Pressable>
  );
  return {
    headerRight: () => (
      <View style={{ flexDirection: 'row' }}>
        {icon('Notifications', 'bell', notifications)}
        {icon('Menu', 'menu', menu)}
      </View>
    ),
  };
}
