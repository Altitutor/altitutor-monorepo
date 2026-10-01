import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';

const paths = {
  undo: '<path d="M9 14 4 9l5-5M4 9h10a7 7 0 0 1 0 14h-3"/>',
  menu: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
};

type StudyHeaderActionsProps = {
  title: string;
  onUndo: () => void;
  onBury: () => void;
  onRefresh: () => void;
  canUndo: boolean;
  canBury: boolean;
  disabled: boolean;
};

function HeaderIcon({ name, label, onPress, disabled = false }: {
  name: keyof typeof paths;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const source = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${theme.primary}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`)}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={withHaptic(onPress)}
      style={{ padding: 12, opacity: disabled ? 0.4 : 1 }}>
      <Image accessibilityIgnoresInvertColors source={{ uri: source }} style={{ width: 24, height: 24 }} />
    </Pressable>
  );
}

function HeaderControls({ onUndo, onBury, onRefresh, canUndo, canBury, disabled }: Omit<StudyHeaderActionsProps, 'title'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);

  function choose(action: () => void) {
    setMenuOpen(false);
    withHaptic(action)();
  }

  return (
    <View style={{ flexDirection: 'row' }}>
      <HeaderIcon name="undo" label="Undo last answer" onPress={onUndo} disabled={disabled || !canUndo} />
      <HeaderIcon name="menu" label="Study actions" onPress={() => setMenuOpen(true)} />
      <Modal visible={menuOpen} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={{ flex: 1 }}>
          <Pressable accessibilityLabel="Close study actions" onPress={() => setMenuOpen(false)} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
          <View accessibilityRole="menu" style={{ position: 'absolute', top: insets.top + 48, right: 12, minWidth: 190, paddingVertical: 5, borderRadius: 14, borderCurve: 'continuous', backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)' }}>
            <Pressable accessibilityRole="menuitem" accessibilityState={{ disabled: disabled || !canBury }} disabled={disabled || !canBury} onPress={() => choose(onBury)} style={{ paddingHorizontal: 16, paddingVertical: 13, opacity: disabled || !canBury ? 0.4 : 1 }}>
              <Text style={{ color: theme.text, fontSize: 15 }}>Bury until tomorrow</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: theme.border }} />
            <Pressable accessibilityRole="menuitem" accessibilityState={{ disabled }} disabled={disabled} onPress={() => choose(onRefresh)} style={{ paddingHorizontal: 16, paddingVertical: 13, opacity: disabled ? 0.4 : 1 }}>
              <Text style={{ color: theme.text, fontSize: 15 }}>Sync study queue</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export function StudyHeaderActions({ title, onUndo, onBury, onRefresh, canUndo, canBury, disabled }: StudyHeaderActionsProps) {
  if (process.env.EXPO_OS === 'ios') {
    return (
      <>
        <Stack.Screen options={{ title }} />
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button icon="arrow.uturn.backward" accessibilityLabel="Undo last answer" disabled={disabled || !canUndo} onPress={withHaptic(onUndo)} />
          <Stack.Toolbar.Menu icon="ellipsis" accessibilityLabel="Study actions">
            <Stack.Toolbar.MenuAction icon="archivebox" disabled={disabled || !canBury} onPress={withHaptic(onBury)}>Bury until tomorrow</Stack.Toolbar.MenuAction>
            <Stack.Toolbar.MenuAction icon="arrow.clockwise" disabled={disabled} onPress={withHaptic(onRefresh)}>Sync study queue</Stack.Toolbar.MenuAction>
          </Stack.Toolbar.Menu>
        </Stack.Toolbar>
      </>
    );
  }

  return <Stack.Screen options={{ title, headerRight: () => <HeaderControls onUndo={onUndo} onBury={onBury} onRefresh={onRefresh} canUndo={canUndo} canBury={canBury} disabled={disabled} /> }} />;
}
