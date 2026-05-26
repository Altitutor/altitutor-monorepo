/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/providers/theme-preference-provider';

export function useTheme() {
  const { resolvedScheme } = useThemePreference();
  return Colors[resolvedScheme];
}
