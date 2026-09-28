import { Pressable, Text } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { withHaptic } from '@/lib/haptics';

export function TopicFileCard({
  title,
  eyebrow,
  onPress,
}: {
  title: string;
  eyebrow?: string;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={eyebrow ? `${eyebrow}. ${title}` : `Open ${title}`}
      onPress={withHaptic(onPress)}
      style={{
        flex: 1,
        backgroundColor: theme.backgroundElement,
        borderRadius: 16,
        borderCurve: 'continuous',
        padding: 12,
        gap: 4,
        minHeight: 76,
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      }}
    >
      {eyebrow ? (
        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {eyebrow}
        </Text>
      ) : null}
      <Text selectable numberOfLines={3} style={{ color: theme.text, fontSize: 14, fontWeight: '600', lineHeight: 18 }}>
        {title}
      </Text>
    </Pressable>
  );
}
