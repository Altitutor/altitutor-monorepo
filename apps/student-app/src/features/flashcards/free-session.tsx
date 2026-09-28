import type { FlashcardReviewCard } from '@altitutor/shared';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';

import { FlashcardContent } from './flashcard-content';
import { StudyFlashcardButton } from './study-buttons';
import { useStudyFeedback } from './study-feedback';
import { StudySurface } from './study-surface';
import { useStudyConnectivity } from './study-connectivity';

export function FreeFlashcardSession({ cards, resetKey, header }: { cards: FlashcardReviewCard[]; resetKey: number; header?: ReactNode }) {
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

  return (
    <StudySurface feedback={feedback} footer={connected && card
      ? !showAnswer
        ? <StudyFlashcardButton tone="primary" onPress={() => setShowAnswer(true)} disabled={card.card_type === 'image_occlusion' && !imageReady}>Show answer</StudyFlashcardButton>
        : <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><StudyFlashcardButton tone="danger" onPress={markAgain}>Again</StudyFlashcardButton></View>
          <View style={{ flex: 1 }}><StudyFlashcardButton tone="success" onPress={markCorrect}>Got it</StudyFlashcardButton></View>
        </View>
      : <StudyFlashcardButton onPress={() => { setQueue(cards); setShowAnswer(false); }} disabled={!connected || cards.length === 0}>Study again</StudyFlashcardButton>
    }>
      {header}
      <Text selectable style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
        {queue.length} remaining · Free study does not change due dates
      </Text>
      {!connected ? <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>A connection is required to study flashcards. Reconnect and reload this topic.</Text> : null}
      {connected && card ? (
        <Card>
          <FlashcardContent card={card} showAnswer={showAnswer} onReadyChange={setImageReady} />
        </Card>
      ) : connected ? (
        <Card>
          <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{cards.length ? 'Free study complete' : 'No flashcards in this topic'}</Text>
        </Card>
      ) : null}
    </StudySurface>
  );
}
