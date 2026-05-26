import { Button, Host, Row, Text } from '@expo/ui/jetpack-compose';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/providers/theme-preference-provider';

export type NativePagerAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type NativePagerProps = {
  actions: NativePagerAction[];
};

export function NativePager({ actions }: NativePagerProps) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();

  return (
    <View style={styles.wrapper}>
      <Host matchContents colorScheme={resolvedScheme} seedColor={theme.primary} style={styles.host}>
        <Row horizontalArrangement={{ spacedBy: 10 }}>
          {actions.map((action) => (
            <Button
              key={action.label}
              enabled={!action.disabled}
              onClick={action.onPress}
              colors={{
                containerColor: theme.backgroundSelected,
                contentColor: theme.primary,
                disabledContainerColor: theme.backgroundSelected,
                disabledContentColor: theme.textSecondary,
              }}>
              <Text color={action.disabled ? theme.textSecondary : theme.primary} style={{ fontWeight: '600' }}>
                {action.label}
              </Text>
            </Button>
          ))}
        </Row>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  host: { minHeight: 48 },
});
