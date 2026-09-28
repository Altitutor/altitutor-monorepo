import type { FlashcardRating, FlashcardStudySnapshot, RateFlashcardCommand } from '@altitutor/shared';
import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';

import { Card } from '@/components/student-ui';
import { useTheme } from '@/hooks/use-theme';

import { flashcardApi, FlashcardApiError } from './flashcard-api';
import { FlashcardContent } from './flashcard-content';
import { StudyFlashcardButton, StudyRatingButton } from './study-buttons';
import { useRateFlashcard } from './flashcard-hooks';
import { availableDueSessionCards, type AnsweredCardHold } from './due-session-model';
import { useStudyFeedback } from './study-feedback';
import { StudyHeaderActions } from './study-header-actions';
import { StudySurface } from './study-surface';
import { useStudyConnectivity } from './study-connectivity';

const ratings: { value: FlashcardRating; label: string; tone: 'danger' | 'warning' | 'success' | 'primary' }[] = [
  { value: 'again', label: 'Again', tone: 'danger' },
  { value: 'hard', label: 'Hard', tone: 'warning' },
  { value: 'good', label: 'Good', tone: 'success' },
  { value: 'easy', label: 'Easy', tone: 'primary' },
];

export function DueFlashcardSession({ snapshot, resetKey, onRefresh, title }: {
  snapshot: FlashcardStudySnapshot;
  resetKey: number;
  onRefresh: () => Promise<void>;
  title: string;
}) {
  const theme = useTheme();
  const connected = useStudyConnectivity();
  const rateMutation = useRateFlashcard();
  const { feedback, showFeedback, clearFeedback } = useStudyFeedback();
  const [answeredHolds, setAnsweredHolds] = useState<ReadonlyMap<string, AnsweredCardHold>>(() => new Map());
  const [now, setNow] = useState(() => new Date());
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const availableCards = availableDueSessionCards(snapshot.cards, answeredHolds, now, pendingCardId);
  const card = availableCards[0] ?? null;
  const [revealedCardId, setRevealedCardId] = useState<string | null>(null);
  const showAnswer = card?.id === revealedCardId;
  const [imageReady, setImageReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [checkingNext, setCheckingNext] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [answerLogId, setAnswerLogId] = useState<string | null>(null);
  const [lastAnsweredCardId, setLastAnsweredCardId] = useState<string | null>(null);
  const shownAt = useRef(0);
  const failedCommand = useRef<RateFlashcardCommand | null>(null);
  const undoCommand = useRef<{ requestId: string; answerLogId: string } | null>(null);

  useEffect(() => {
    setImageReady(false);
    setNeedsRefresh(false);
    shownAt.current = new Date().getTime();
  }, [card?.id, card?.revision]);

  useEffect(() => {
    setNow(new Date());
  }, [resetKey]);

  useEffect(() => {
    const nextDue = [...answeredHolds.values()]
      .map((hold) => new Date(hold.dueAt).getTime())
      .filter((time) => time > now.getTime() && time - now.getTime() <= 60 * 60_000)
      .sort((left, right) => left - right)[0];
    if (nextDue === undefined) return;
    const timer = setTimeout(() => {
      setNow(new Date());
      void onRefresh().catch(() => setNeedsRefresh(true));
    }, Math.max(0, nextDue - now.getTime()));
    return () => clearTimeout(timer);
  }, [answeredHolds, now, onRefresh]);

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
    showFeedback(rating === 'again' ? 'incorrect' : 'correct', rating === 'again' ? 'danger' : rating === 'hard' ? 'warning' : rating === 'good' ? 'success' : 'primary');
    setPendingCardId(card.id);
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
      setAnsweredHolds((current) => new Map(current).set(card.id, { revision: command.expectedRevision, dueAt: result.due_at }));
      setNow(new Date());
      setAnswerLogId(result.answer_log_id ?? null);
      setLastAnsweredCardId(card.id);
      setRevealedCardId(null);
      setCheckingNext(true);
      void onRefresh().then(() => {
        setNeedsRefresh(false);
      }).catch(() => {
        setNeedsRefresh(true);
        setMessage('Your answer was saved, but the next card could not load. Refresh to continue.');
      }).finally(() => setCheckingNext(false));
      if (result.leech_suggested) {
        Alert.alert('Difficult card', 'This card has been repeatedly difficult. Suspend it for now?', [
          { text: 'Keep studying', style: 'cancel' },
          { text: 'Suspend', onPress: () => { void flashcardApi.manage(card.id, 'suspend', randomUUID()).then(onRefresh).catch(() => setMessage('Could not suspend this card. Please try in Manage.')); } },
        ]);
      }
    } catch (error) {
      clearFeedback();
      if (error instanceof FlashcardApiError && error.status === 409) {
        failedCommand.current = null;
        setRevealedCardId(null);
        setMessage('That answer could not be applied because the card’s schedule changed or it is no longer due. The latest queue has been loaded.');
        try { await onRefresh(); } catch { setNeedsRefresh(true); }
      } else {
        failedCommand.current = command;
        setMessage('Your answer was not confirmed. Retry the same rating when connected.');
      }
    } finally {
      setPendingCardId(null);
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
      setLastAnsweredCardId(null);
      setAnsweredHolds((current) => {
        const next = new Map(current);
        if (lastAnsweredCardId) next.delete(lastAnsweredCardId);
        return next;
      });
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
  const visibleCounts = availableCards.reduce(
    (counts, item) => {
      if (item.state === 'New') counts.new += 1;
      else if (item.state === 'Review') counts.review += 1;
      else counts.learning += 1;
      return counts;
    },
    { new: 0, learning: 0, review: 0 },
  );
  const nextHeldDue = [...answeredHolds.values()]
    .map((hold) => new Date(hold.dueAt).getTime())
    .filter((time) => time > now.getTime() && time - now.getTime() <= 60 * 60_000)
    .sort((left, right) => left - right)[0];
  return (
    <>
      <StudyHeaderActions
        title={title}
        onUndo={() => void undo()}
        onBury={() => void bury()}
        onRefresh={() => void refresh()}
        canUndo={Boolean(answerLogId) && connected}
        canBury={Boolean(card) && !needsRefresh && connected}
        disabled={pending || !connected}
      />
      <StudySurface feedback={feedback} footer={
        <View style={{ gap: 8 }}>
          <Text selectable style={{ color: theme.textSecondary, fontVariant: ['tabular-nums'], textAlign: 'center' }}>
            {visibleCounts.new} new · {visibleCounts.learning} learning · {visibleCounts.review} review
          </Text>
          {needsRefresh ? <Text selectable style={{ color: theme.textSecondary, textAlign: 'center' }}>Refresh the queue to continue.</Text>
            : connected && card ? !showAnswer
              ? <StudyFlashcardButton tone="primary" onPress={() => setRevealedCardId(card.id)} disabled={pending || (card.card_type === 'image_occlusion' && !imageReady)}>Show answer</StudyFlashcardButton>
              : <View style={{ flexDirection: 'row', gap: 6 }}>
                {ratings.map((option) => (
                  <StudyRatingButton
                    key={option.value}
                    label={option.label}
                    preview={card.rating_previews?.[option.value]?.label}
                    tone={option.tone}
                    onPress={() => void rate(option.value)}
                    disabled={pending}
                  />
                ))}
              </View>
              : null}
        </View>
      }>
      {message ? <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>{message}</Text> : null}
      {!connected ? <Text selectable accessibilityRole="alert" style={{ color: theme.danger }}>A connection is required to study flashcards. Reconnect and refresh to continue.</Text> : null}
      {connected && card && !needsRefresh ? (
        <Card>
          <Text selectable style={{ color: theme.textSecondary, fontSize: 13 }}>
            {[card.subject_short_name, card.topic_code, card.topic_name].filter(Boolean).join(' · ')}
          </Text>
          <FlashcardContent card={card} showAnswer={showAnswer} onReadyChange={setImageReady} />
        </Card>
      ) : connected && !needsRefresh ? (
        <Card>
          <Text selectable style={{ color: theme.text, fontSize: 18, fontWeight: '700' }}>{pending || checkingNext ? 'Loading next card…' : nextHeldDue ? 'You’re caught up for now' : 'No cards due'}</Text>
          {nextHeldDue ? <Text selectable style={{ color: theme.textSecondary }}>Next scheduled card: {new Date(nextHeldDue).toLocaleTimeString()}.</Text> : null}
          {held.newLimit > 0 ? <Text selectable style={{ color: theme.textSecondary }}>{held.newLimit} new cards are held by today’s limit.</Text> : null}
          {held.reviewLimit > 0 ? <Text selectable style={{ color: theme.textSecondary }}>{held.reviewLimit} reviews are held by today’s limit.</Text> : null}
          {held.newBlockedByReviews > 0 ? <Text selectable style={{ color: theme.textSecondary }}>{held.newBlockedByReviews} new cards wait for overdue reviews.</Text> : null}
          {held.futureLearning > 0 && snapshot.nextDueAt ? <Text selectable style={{ color: theme.textSecondary }}>Next learning card: {new Date(snapshot.nextDueAt).toLocaleTimeString()}.</Text> : null}
        </Card>
      ) : null}
      {pending ? <Text selectable style={{ color: theme.textSecondary, textAlign: 'center' }}>Saving…</Text> : null}
      </StudySurface>
    </>
  );
}
