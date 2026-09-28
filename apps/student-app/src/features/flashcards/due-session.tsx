import type { FlashcardRating, FlashcardStudySnapshot, RateFlashcardCommand } from '@altitutor/shared';
import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Card } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';

import { flashcardApi, FlashcardApiError } from './flashcard-api';
import { FlashcardContent } from './flashcard-content';
import { FlashcardButton } from './flashcard-controls';
import { useRateFlashcard } from './flashcard-hooks';
import { useStudyConnectivity } from './study-connectivity';

const ratings: { value: FlashcardRating; label: string; tone: 'danger' | 'warning' | 'success' | 'primary' }[] = [
  { value: 'again', label: 'Again', tone: 'danger' },
  { value: 'hard', label: 'Hard', tone: 'warning' },
  { value: 'good', label: 'Good', tone: 'success' },
  { value: 'easy', label: 'Easy', tone: 'primary' },
];

export function DueFlashcardSession({ snapshot, resetKey, onRefresh }: {
  snapshot: FlashcardStudySnapshot;
  resetKey: number;
  onRefresh: () => Promise<void>;
}) {
  const theme = useTheme();
  const connected = useStudyConnectivity();
  const card = snapshot.cards[0] ?? null;
  const rateMutation = useRateFlashcard();
  const [showAnswer, setShowAnswer] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [answerLogId, setAnswerLogId] = useState<string | null>(null);
  const shownAt = useRef(0);
  const failedCommand = useRef<RateFlashcardCommand | null>(null);
  const undoCommand = useRef<{ requestId: string; answerLogId: string } | null>(null);

  useEffect(() => {
    setShowAnswer(false);
    setImageReady(false);
    setNeedsRefresh(false);
    shownAt.current = new Date().getTime();
    failedCommand.current = null;
  }, [card?.id, resetKey]);

  async function refresh() {
    setPending(true);
    try {
      await onRefresh();
      setNeedsRefresh(false);
      setMessage(null);
    } catch {
      setMessage('Could not refresh your study queue. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  async function rate(rating: FlashcardRating) {
    if (!connected || !card || pending || needsRefresh) return;
    const command = failedCommand.current?.reviewCardId === card.id && failedCommand.current.rating === rating
      ? failedCommand.current
      : {
        reviewCardId: card.id,
        rating,
        requestId: randomUUID(),
        expectedRevision: card.revision,
        durationMs: Math.min(60000, Math.max(0, new Date().getTime() - shownAt.current)),
        previewSeed: card.rating_preview_seed ?? `${card.id}:${card.revision}`,
        answeredAt: new Date().toISOString(),
      };
    setPending(true);
    setMessage(null);
    try {
      let result;
      try {
        result = await rateMutation.mutateAsync(command);
      } catch (error) {
        if (!(error instanceof FlashcardApiError) || error.code !== 'flashcard_command_in_progress') throw error;
        await new Promise((resolve) => setTimeout(resolve, 150));
        result = await rateMutation.mutateAsync(command);
      }
      failedCommand.current = null;
      setAnswerLogId(result.answer_log_id ?? null);
      setNeedsRefresh(true);
      try {
        await onRefresh();
        setNeedsRefresh(false);
        setShowAnswer(false);
      } catch {
        setMessage('Your answer was saved, but the next card could not load. Refresh to continue.');
      }
      if (result.leech_suggested) {
        Alert.alert('Difficult card', 'This card has been repeatedly difficult. Suspend it for now?', [
          { text: 'Keep studying', style: 'cancel' },
          { text: 'Suspend', onPress: () => { void flashcardApi.manage(card.id, 'suspend', randomUUID()).then(onRefresh).catch(() => setMessage('Could not suspend this card. Please try in Manage.')); } },
        ]);
      }
    } catch (error) {
      if (error instanceof FlashcardApiError && error.status === 409) {
        failedCommand.current = null;
        setMessage('This card changed on another screen. Your answer was not saved; the queue has been refreshed.');
        try { await onRefresh(); } catch { setNeedsRefresh(true); }
      } else {
        failedCommand.current = command;
        setMessage('Your answer was not confirmed. Retry the same rating when connected.');
      }
    } finally {
      setPending(false);
    }
  }

  async function undo() {
    if (!connected || !answerLogId || pending) return;
    const command = undoCommand.current?.answerLogId === answerLogId
      ? undoCommand.current : { answerLogId, requestId: randomUUID() };
    undoCommand.current = command;
    setPending(true);
    setMessage(null);
    try {
      try {
        await flashcardApi.undo(command.answerLogId, command.requestId);
      } catch (error) {
        if (!(error instanceof FlashcardApiError) || error.code !== 'flashcard_command_in_progress') throw error;
        await new Promise((resolve) => setTimeout(resolve, 150));
        await flashcardApi.undo(command.answerLogId, command.requestId);
      }
      setAnswerLogId(null);
      undoCommand.current = null;
      setNeedsRefresh(true);
      await onRefresh();
      setNeedsRefresh(false);
      setMessage('Your last answer was undone.');
    } catch (error) {
      if (error instanceof FlashcardApiError && error.status === 409) {
        setAnswerLogId(null);
        undoCommand.current = null;
        setMessage('That answer can no longer be undone because the card changed.');
        await onRefresh().catch(() => setNeedsRefresh(true));
      } else {
        setMessage('Could not confirm the undo. Please retry.');
      }
    } finally {
      setPending(false);
    }
  }

  async function bury() {
    if (!connected || !card || pending) return;
    setPending(true);
    setMessage(null);
    try {
      await flashcardApi.manage(card.id, 'bury', randomUUID());
      setNeedsRefresh(true);
      await onRefresh();
      setNeedsRefresh(false);
    } catch {
      setMessage('Could not confirm that this card was buried. Refresh before continuing.');
      setNeedsRefresh(true);
    } finally {
      setPending(false);
    }
  }

  const held = snapshot.held;
  return (
    <View style={{ gap: 14 }}>
      <Text selectable style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'] }}>
        {snapshot.counts.new} new · {snapshot.counts.learning + snapshot.counts.relearning} learning · {snapshot.counts.review} review
      </Text>
      {message ? <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>{message}</Text> : null}
      {!connected ? <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>A connection is required to study flashcards. Reconnect and refresh to continue.</Text> : null}
      {needsRefresh ? <FlashcardButton onPress={() => void refresh()} disabled={pending}>Refresh queue</FlashcardButton> : null}
      {connected && card && !needsRefresh ? (
        <Card>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            {[card.subject_short_name, card.topic_code, card.topic_name].filter(Boolean).join(' · ')}
          </Text>
          <FlashcardContent card={card} showAnswer={showAnswer} onReadyChange={setImageReady} />
          {!showAnswer ? (
            <FlashcardButton tone="primary" onPress={() => setShowAnswer(true)} disabled={pending || (card.card_type === 'image_occlusion' && !imageReady)}>Show answer</FlashcardButton>
          ) : (
            <View style={{ gap: 8 }}>
              {ratings.map((option) => (
                <FlashcardButton key={option.value} tone={option.tone} onPress={() => void rate(option.value)} disabled={pending}>
                  {option.label}{card.rating_previews?.[option.value] ? ` · ${card.rating_previews[option.value].label}` : ''}
                </FlashcardButton>
              ))}
            </View>
          )}
          <FlashcardButton onPress={() => void bury()} disabled={pending}>Bury until tomorrow</FlashcardButton>
        </Card>
      ) : connected && !needsRefresh ? (
        <Card>
          <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>No cards due</Text>
          {held.newLimit > 0 ? <Text selectable style={{ color: theme.textSecondary }}>{held.newLimit} new cards are held by today’s limit.</Text> : null}
          {held.reviewLimit > 0 ? <Text selectable style={{ color: theme.textSecondary }}>{held.reviewLimit} reviews are held by today’s limit.</Text> : null}
          {held.newBlockedByReviews > 0 ? <Text selectable style={{ color: theme.textSecondary }}>{held.newBlockedByReviews} new cards wait for overdue reviews.</Text> : null}
          {held.futureLearning > 0 && snapshot.nextDueAt ? <Text selectable style={{ color: theme.textSecondary }}>Next learning card: {new Date(snapshot.nextDueAt).toLocaleTimeString()}.</Text> : null}
        </Card>
      ) : null}
      {connected && answerLogId ? <FlashcardButton onPress={() => void undo()} disabled={pending}>Undo last answer</FlashcardButton> : null}
      <FlashcardButton onPress={() => void refresh()} disabled={pending || !connected}>Refresh</FlashcardButton>
      {pending ? <Text selectable style={{ color: theme.textSecondary, textAlign: 'center' }}>Saving…</Text> : null}
    </View>
  );
}
