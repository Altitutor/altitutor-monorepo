'use client';

import { ResourcesBreadcrumb } from '@/features/resources';
import { FlashcardReviewSession, useDueFlashcardReviewCards } from '@/features/flashcards';
import { StudentPageContainer } from '@/shared/components/layouts';
import { Alert, AlertDescription, AlertTitle, Button } from '@altitutor/ui';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function DueFlashcardsPage() {
  const searchParams = useSearchParams();
  const scopedTopicIds = searchParams.get('topicIds')?.split(',').filter(Boolean);
  const {
    data: snapshot,
    error: cardsError,
    isLoading: cardsLoading,
    refetch,
  } = useDueFlashcardReviewCards(scopedTopicIds);
  const undoLatest = async () => {
    const response = await fetch('/api/flashcards/review-cards/undo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID() }) });
    if (response.ok) void refetch();
  };

  return (
    <StudentPageContainer className="space-y-8">
      <ResourcesBreadcrumb
        items={[
          { label: 'Resources', href: '/resources' },
          { label: 'Flashcards' },
        ]}
      />

      <div className="space-y-6">
        {snapshot?.timezoneConfirmationRequired ? <Alert><AlertTitle>Confirm your study-day timezone</AlertTitle><AlertDescription>We’re using Australia/Adelaide for now. <Link className="underline" href="/settings/flashcards">Confirm or change it</Link>; studying is not blocked.</AlertDescription></Alert> : null}
        <div id="tour-flashcards-header">
          <div className="flex items-center justify-between"><h1 className="text-3xl font-bold tracking-tight">Flashcards</h1><div className="flex gap-2"><Button variant="ghost" onClick={()=>void undoLatest()}>Undo last answer</Button><Button variant="outline" asChild><Link href="/resources/flashcards/manage">Manage</Link></Button></div></div>
          <p className="mt-1 text-muted-foreground">
            {cardsError ? 'Unable to load due cards' : `${snapshot?.counts.total ?? 0} due now`}
          </p>
          {snapshot ? <p className="text-sm text-muted-foreground">{snapshot.counts.new} New · {snapshot.counts.learning} Learning · {snapshot.counts.relearning} Relearning · {snapshot.counts.review} Review</p> : null}
        </div>

        {cardsLoading ? (
          <div className="h-64 rounded-2xl bg-muted/50" />
        ) : cardsError ? (
          <Alert variant="destructive">
            <AlertTitle>Could not load flashcards</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>Your cards may still be due. Please try loading them again.</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <FlashcardReviewSession
            topicId="due-all"
            mode="due"
            cards={snapshot?.cards ?? []}
            emptyDescription="There are no due flashcards right now."
          />
        )}
        {snapshot && snapshot.nextDueAt ? (
          <p className="text-center text-sm text-muted-foreground">{snapshot.held.futureLearning} learning {snapshot.held.futureLearning === 1 ? 'card is' : 'cards are'} not due yet. Next card in {Math.max(1,Math.ceil((new Date(snapshot.nextDueAt).getTime()-Date.now())/60_000))}m.</p>
        ) : null}
        {snapshot && (snapshot.held.reviewLimit || snapshot.held.newLimit || snapshot.held.newBlockedByReviews) ? (
          <p className="text-center text-sm text-muted-foreground">
            {snapshot.held.reviewLimit ? `${snapshot.held.reviewLimit} reviews held by today’s limit. ` : ''}
            {snapshot.held.newBlockedByReviews ? `${snapshot.held.newBlockedByReviews} new cards wait until overdue reviews are cleared.` : ''}
            {snapshot.held.newLimit ? `${snapshot.held.newLimit} new cards held by today’s limit.` : ''}
          </p>
        ) : null}
      </div>
    </StudentPageContainer>
  );
}
