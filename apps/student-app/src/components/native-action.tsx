import { Button, Host } from '@expo/ui';
import { StyleSheet, View } from 'react-native';

type NativeActionProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function NativeAction({ label, onPress, disabled }: NativeActionProps) {
  return (
    <View style={styles.wrapper}>
      <Host style={styles.host}>
        <Button label={label} onPress={onPress} disabled={disabled} />
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { minHeight: 48, width: '100%' },
  host: { flex: 1, width: '100%' },
});
