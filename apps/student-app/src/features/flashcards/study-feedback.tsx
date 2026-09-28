import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

export type StudyFeedbackState = {
  id: number;
  kind: 'correct' | 'incorrect';
  tone: 'danger' | 'warning' | 'success' | 'primary';
};

const iconPaths = {
  correct: '<path d="M11 20.5 21 30l20-23" />',
  incorrect: '<path d="M14 14 38 38M38 14 14 38" />',
};

export function useStudyFeedback() {
  const [feedback, setFeedback] = useState<StudyFeedbackState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);

  const clearFeedback = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setFeedback(null);
  }, []);

  const showFeedback = useCallback((kind: StudyFeedbackState['kind'], tone: StudyFeedbackState['tone']) => {
    if (timer.current) clearTimeout(timer.current);
    nextId.current += 1;
    setFeedback({ id: nextId.current, kind, tone });
    timer.current = setTimeout(() => {
      setFeedback(null);
      timer.current = null;
    }, 650);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  return { feedback, showFeedback, clearFeedback };
}

export function StudyFeedback({ feedback }: { feedback: StudyFeedbackState | null }) {
  const theme = useTheme();
  if (!feedback) return null;

  const backgroundColor = theme[feedback.tone];
  const source = `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="52" height="52" viewBox="0 0 52 52" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${iconPaths[feedback.kind]}</svg>`)}`;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        key={feedback.id}
        entering={ZoomIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={{ width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', backgroundColor, boxShadow: '0 12px 28px rgba(0, 0, 0, 0.24)' }}>
        <Image source={{ uri: source }} style={{ width: 52, height: 52 }} />
      </Animated.View>
    </View>
  );
}
