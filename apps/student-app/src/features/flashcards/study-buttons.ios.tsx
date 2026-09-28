import { Button, Host, Text, VStack } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  buttonBorderShape,
  buttonStyle,
  controlSize,
  disabled as disabledModifier,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { Platform, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';
import { useThemePreference } from '@/providers/theme-preference-provider';

type StudyTone = 'default' | 'primary' | 'danger' | 'success' | 'warning';

const glassAvailable = Number(Platform.Version) >= 26;

export function StudyFlashcardButton({ children, onPress, disabled = false, tone = 'default' }: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: StudyTone;
}) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const color = tone === 'default' ? theme.primary : theme[tone];
  const prominent = tone !== 'default';
  const appearance = prominent
    ? (glassAvailable ? 'glassProminent' : 'borderedProminent')
    : (glassAvailable ? 'glass' : 'bordered');

  return (
    <View style={{ width: '100%', minHeight: 48 }}>
      <Host colorScheme={resolvedScheme} seedColor={color} matchContents={{ vertical: true }} style={{ width: '100%', minHeight: 48 }}>
        <Button
          label={children}
          onPress={withHaptic(onPress)}
          modifiers={[
            buttonStyle(appearance),
            tint(color),
            foregroundStyle(prominent ? theme.backgroundElement : theme.text),
            buttonBorderShape('capsule'),
            controlSize('large'),
            frame({ maxWidth: Infinity, minHeight: 48 }),
            ...(disabled ? [disabledModifier()] : []),
          ]}
        />
      </Host>
    </View>
  );
}

export function StudyRatingButton({ label, preview, tone, onPress, disabled = false }: {
  label: string;
  preview?: string;
  tone: Exclude<StudyTone, 'default'>;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const { resolvedScheme } = useThemePreference();
  const color = theme[tone];

  return (
    <View style={{ flex: 1, minWidth: 0, minHeight: 62 }}>
      <Host colorScheme={resolvedScheme} seedColor={color} matchContents={{ vertical: true }} style={{ width: '100%', minHeight: 62 }}>
        <Button
          onPress={withHaptic(onPress)}
          modifiers={[
            buttonStyle(glassAvailable ? 'glassProminent' : 'borderedProminent'),
            tint(color),
            foregroundStyle(theme.backgroundElement),
            buttonBorderShape('capsule'),
            frame({ maxWidth: Infinity, minHeight: 62 }),
            accessibilityLabel(preview ? `${label}, ${preview}` : label),
            ...(disabled ? [disabledModifier()] : []),
          ]}>
          <VStack spacing={1} alignment="center" modifiers={[frame({ maxWidth: Infinity })]}>
            <Text modifiers={[font({ size: 14, weight: 'bold' }), lineLimit(1), minimumScaleFactor(0.75)]}>{label}</Text>
            {preview ? <Text modifiers={[font({ size: 11 }), lineLimit(1), minimumScaleFactor(0.7)]}>{preview}</Text> : null}
          </VStack>
        </Button>
      </Host>
    </View>
  );
}
