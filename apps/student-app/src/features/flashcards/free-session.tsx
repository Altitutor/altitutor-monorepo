import type { FlashcardReviewCard } from '@altitutor/shared';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Card } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';

import { FlashcardContent } from './flashcard-content';
import { FlashcardButton } from './flashcard-controls';
import { useStudyConnectivity } from './study-connectivity';

export function FreeFlashcardSession({ cards, resetKey }: { cards: FlashcardReviewCard[]; resetKey: number }) {
  const theme = useTheme();
  const connected = useStudyConnectivity();
  const [queue, setQueue] = useState(cards);
  const [showAnswer, setShowAnswer] = useState(false);
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    setQueue(cards);
    setShowAnswer(false);
  }, [cards, resetKey]);

  const card = queue[0] ?? null;
  useEffect(() => {
    setImageReady(false);
  }, [card?.id]);

  function markCorrect() {
    setQueue((current) => current.slice(1));
    setShowAnswer(false);
  }

  function markAgain() {
    setQueue((current) => current.length > 1 ? [...current.slice(1), current[0]] : current);
    setShowAnswer(false);
  }

  return (
    <View style={{ gap: 14 }}>
      <Text selectable style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
        {queue.length} remaining · Free study does not change due dates
      </Text>
      {!connected ? <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>A connection is required to study flashcards. Reconnect and reload this topic.</Text> : null}
      {connected && card ? (
        <Card>
          <FlashcardContent card={card} showAnswer={showAnswer} onReadyChange={setImageReady} />
          {!showAnswer ? (
            <FlashcardButton tone="primary" onPress={() => setShowAnswer(true)} disabled={card.card_type === 'image_occlusion' && !imageReady}>Show answer</FlashcardButton>
          ) : (
            <View style={{ gap: 8 }}>
              <FlashcardButton tone="danger" onPress={markAgain}>Again · see later</FlashcardButton>
              <FlashcardButton tone="success" onPress={markCorrect}>Got it</FlashcardButton>
            </View>
          )}
        </Card>
      ) : connected ? (
        <Card>
          <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{cards.length ? 'Free study complete' : 'No flashcards in this topic'}</Text>
          {cards.length ? <FlashcardButton onPress={() => { setQueue(cards); setShowAnswer(false); }}>Study again</FlashcardButton> : null}
        </Card>
      ) : null}
    </View>
  );
}
