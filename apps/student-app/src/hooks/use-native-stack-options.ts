import { Platform } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

export function useNativeStackOptions() {
  const theme = useTheme();

  return {
    headerShown: true,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerLargeTitleEnabled: Platform.OS === 'ios',
    headerLargeTitleShadowVisible: false,
    headerShadowVisible: false,
    headerTintColor: theme.primary,
    contentStyle: { backgroundColor: theme.background },
    scrollEdgeEffects: { top: 'automatic', bottom: 'automatic' } as const,
  };
}
