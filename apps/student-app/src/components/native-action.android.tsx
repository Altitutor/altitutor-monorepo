import { Button, Host, Text } from '@expo/ui/jetpack-compose';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/providers/theme-preference-provider';

type NativeActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function NativeAction({ label, onPress, disabled }: NativeActionProps) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();

  return (
    <View style={styles.wrapper}>
      <Host matchContents colorScheme={resolvedScheme} seedColor={theme.primary} style={styles.host}>
        <Button
          enabled={!disabled}
          onClick={onPress}
          colors={{
            containerColor: theme.primary,
            contentColor: theme.backgroundElement,
            disabledContainerColor: theme.backgroundSelected,
            disabledContentColor: theme.textSecondary,
          }}>
          <Text color={theme.backgroundElement} style={{ fontWeight: '600' }}>{label}</Text>
        </Button>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  host: { minHeight: 48 },
});
