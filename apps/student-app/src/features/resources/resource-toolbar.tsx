import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';

type ResourceToolbarProps = {
  previous: () => void;
  next: () => void;
  previousDisabled?: boolean;
  nextDisabled?: boolean;
  onNavigator: () => void;
  onSolutions?: () => void;
  previousLabel: string;
  nextLabel: string;
  navigatorLabel: string;
  solutionsLabel?: string;
};

export function ResourceToolbar({
  previous,
  next,
  previousDisabled,
  nextDisabled,
  onNavigator,
  onSolutions,
  previousLabel,
  nextLabel,
  navigatorLabel,
  solutionsLabel = 'View solutions',
}: ResourceToolbarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (process.env.EXPO_OS === 'ios') {
    return (
      <Stack.Toolbar placement="bottom">
        <Stack.Toolbar.Button
          icon="chevron.left"
          accessibilityLabel={previousLabel}
          disabled={previousDisabled}
          onPress={withHaptic(previous)}
        >
          {previousLabel}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        {onSolutions ? (
          <Stack.Toolbar.Button icon="doc.text" accessibilityLabel={solutionsLabel} onPress={withHaptic(onSolutions)}>
            Solutions
          </Stack.Toolbar.Button>
        ) : null}
        <Stack.Toolbar.Button
          icon="square.grid.2x2"
          accessibilityLabel={navigatorLabel}
          onPress={withHaptic(onNavigator)}
        >
          {navigatorLabel}
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Spacer />
        <Stack.Toolbar.Button
          icon="chevron.right"
          accessibilityLabel={nextLabel}
          disabled={nextDisabled}
          onPress={withHaptic(next)}
        >
          {nextLabel}
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
    );
  }

  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingBottom: Math.max(insets.bottom, 12),
        paddingTop: 8,
        paddingHorizontal: 12,
        backgroundColor: theme.backgroundElement,
        borderTopWidth: 0.5,
        borderColor: theme.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previousLabel}
        disabled={previousDisabled}
        onPress={withHaptic(previous)}
        style={{ padding: 12, opacity: previousDisabled ? 0.3 : 1 }}
      >
        <Text style={{ color: theme.primary, fontSize: 26 }}>←</Text>
      </Pressable>
      {onSolutions ? (
        <Pressable accessibilityRole="button" accessibilityLabel={solutionsLabel} onPress={withHaptic(onSolutions)} style={{ padding: 12 }}>
          <Text style={{ color: theme.primary, fontSize: 15, fontWeight: '600' }}>Solutions</Text>
        </Pressable>
      ) : null}
      <Pressable accessibilityRole="button" accessibilityLabel={navigatorLabel} onPress={withHaptic(onNavigator)} style={{ padding: 12 }}>
        <Image
          source={{
            uri: `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${theme.primary}" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`)}`,
          }}
          style={{ width: 24, height: 24 }}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextLabel}
        disabled={nextDisabled}
        onPress={withHaptic(next)}
        style={{ padding: 12, opacity: nextDisabled ? 0.3 : 1 }}
      >
        <Text style={{ color: theme.primary, fontSize: 26 }}>→</Text>
      </Pressable>
    </View>
  );
}
