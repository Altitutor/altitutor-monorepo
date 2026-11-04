import { Image } from 'expo-image';
import type { FlashcardReviewCard } from '@altitutor/shared';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';
import { haptic } from '@/lib/haptics';

import { FlashcardContent } from './flashcard-content';
import { StudyFlashcardButton } from './study-buttons';
import { useStudyFeedback } from './study-feedback';
import { StudySurface } from './study-surface';
import { useStudyConnectivity } from './study-connectivity';

export function FreeFlashcardSession({ cards, resetKey, onInfo, onStudyDue }: {
  cards: FlashcardReviewCard[];
  resetKey: number;
  onInfo: () => void;
  onStudyDue: () => void;
}) {
  const theme = useTheme();
  const connected = useStudyConnectivity();
  const { feedback, showFeedback, clearFeedback } = useStudyFeedback();
  const [queue, setQueue] = useState(cards);
  const [showAnswer, setShowAnswer] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    setQueue(cards);
    setShowAnswer(false);
    clearFeedback();
  }, [cards, resetKey, clearFeedback]);

  const card = queue[0] ?? null;
  useEffect(() => {
    setImageReady(false);
  }, [card?.id]);

  function markCorrect() {
    showFeedback('correct', 'success');
    setQueue((current) => current.slice(1));
    setShowAnswer(false);
  }

  function markAgain() {
    showFeedback('incorrect', 'danger');
    setQueue((current) => current.length > 1 ? [...current.slice(1), current[0]] : current);
    setShowAnswer(false);
  }

  const completed = Math.max(0, cards.length - queue.length);
  const progress = cards.length === 0 ? 0 : completed / cards.length;
  return (
    <StudySurface feedback={feedback} notice={connected ? null : 'A connection is required to study flashcards. Reconnect and reload this topic.'} noticeTone="danger" footer={connected && card
      ? !showAnswer
        ? <StudyFlashcardButton tone="primary" onPress={() => setShowAnswer(true)} disabled={card.card_type === 'image_occlusion' && !imageReady}>Show answer</StudyFlashcardButton>
        : <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><StudyFlashcardButton tone="danger" onPress={markAgain}>Again</StudyFlashcardButton></View>
          <View style={{ flex: 1 }}><StudyFlashcardButton tone="success" onPress={markCorrect}>Got it</StudyFlashcardButton></View>
        </View>
      : <StudyFlashcardButton onPress={() => { setQueue(cards); setShowAnswer(false); }} disabled={!connected || cards.length === 0}>Study again</StudyFlashcardButton>
    }>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, height: 6, borderRadius: 999, backgroundColor: theme.backgroundSelected, overflow: 'hidden' }}>
          <View style={{ width: `${Math.round(progress * 100)}%`, height: 6, backgroundColor: theme.primary }} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="About free study" onPressIn={() => haptic()} onPress={onInfo} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Image source="sf:info.circle" tintColor={theme.primary} style={{ width: 22, height: 22 }} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Study due cards" onPressIn={() => haptic()} onPress={onStudyDue} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
          <Image source="sf:calendar" tintColor={theme.primary} style={{ width: 22, height: 22 }} />
        </Pressable>
      </View>
      {connected && card ? (
        <FlashcardContent card={card} showAnswer={showAnswer} onReadyChange={setImageReady} />
      ) : connected ? (
        <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{cards.length ? 'Free study complete' : 'No flashcards in this topic'}</Text>
      ) : null}
    </StudySurface>
  );
}
