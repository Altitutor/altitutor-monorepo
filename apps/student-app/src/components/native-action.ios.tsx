import { Button, Host } from '@expo/ui/swift-ui';
import { buttonStyle, disabled as disabledModifier } from '@expo/ui/swift-ui/modifiers';
import { StyleSheet, View } from 'react-native';

type NativeActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function NativeAction({ label, onPress, disabled }: NativeActionProps) {
  return (
    <View style={styles.wrapper}>
      <Host matchContents style={styles.host}>
        <Button
          label={label}
          onPress={onPress}
          modifiers={[buttonStyle('glassProminent'), ...(disabled ? [disabledModifier()] : [])]}
        />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  host: { minHeight: 48 },
});
