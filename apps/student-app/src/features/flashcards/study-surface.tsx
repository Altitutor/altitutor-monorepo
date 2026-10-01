import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/hooks/use-theme';

import { StudyFeedback, type StudyFeedbackState } from './study-feedback';

export function StudySurface({ children, footer, feedback = null }: { children: ReactNode; footer: ReactNode; feedback?: StudyFeedbackState | null }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 24, gap: 14, flexGrow: 1 }}>
        {children}
      </ScrollView>
      <View style={{ borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.backgroundElement, paddingHorizontal: 14, paddingTop: 10, paddingBottom: Math.max(12, insets.bottom + 8), gap: 8 }}>
        {footer}
      </View>
      <StudyFeedback feedback={feedback} />
    </View>
  );
}
