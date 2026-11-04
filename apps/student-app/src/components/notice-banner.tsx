import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

export function NoticeBanner({ message, tone = 'neutral' }: { message: string | null; tone?: 'neutral' | 'danger' }) {
  const theme = useTheme();
  const reducedMotion = useReducedMotion();
  if (!message) return null;
  const entering = reducedMotion ? FadeIn.duration(180) : SlideInDown.springify().damping(20).stiffness(220);
  return (
    <Animated.View entering={entering} exiting={FadeOut.duration(160)} accessibilityRole="alert">
      <View style={{
        marginHorizontal: 16,
        marginTop: 8,
        borderRadius: 16,
        borderCurve: 'continuous',
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: tone === 'danger' ? theme.danger : theme.backgroundElement,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
      }}>
        <Text selectable style={{ color: tone === 'danger' ? '#FFFFFF' : theme.text, fontSize: 15, fontWeight: '600', lineHeight: 20 }}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
