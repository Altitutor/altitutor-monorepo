import { Button, Host, HStack } from '@expo/ui/swift-ui';
import { buttonStyle, disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

export type NativePagerAction = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

type NativePagerProps = {
  actions: NativePagerAction[];
};

export function NativePager({ actions }: NativePagerProps) {
  return (
    <View style={styles.wrapper}>
      <Host matchContents style={styles.host}>
        <HStack spacing={10}>
          {actions.map((action) => (
            <Button
              key={action.label}
              label={action.label}
              onPress={action.onPress}
              modifiers={[buttonStyle('glass'), ...(action.disabled ? [disabledModifier()] : [])]}
            />
          ))}
        </HStack>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  host: { minHeight: 48 },
});
