import { Badge, Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui'
import { MessageSquareText, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { ExplanationFeedbackSummary as Feedback } from '@/features/ucat/reconciliation/api/reconciliation'

const REASON_LABELS: Record<string, string> = {
  inaccurate: 'Inaccurate',
  unclear: 'Unclear',
  not_relevant: 'Not relevant',
  too_generic: 'Too generic',
  timing_advice_wrong: 'Timing advice is wrong',
  skips_steps: 'Skips steps',
  too_long: 'Too long',
  other: 'Other',
}

export function ExplanationFeedbackSummary({ feedback }: { feedback: Feedback | null | undefined }) {
  if (!feedback || feedback.downvotes + feedback.upvotes === 0) return null

  return (
    <Card className={feedback.downvotes > 0 ? 'border-amber-300/70 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/20' : undefined}>
      <CardHeader className="space-y-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <MessageSquareText className="h-4 w-4" />
          Student explanation feedback
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="gap-1"><ThumbsDown className="h-3 w-3" />{feedback.downvotes}</Badge>
          <Badge variant="outline" className="gap-1"><ThumbsUp className="h-3 w-3" />{feedback.upvotes}</Badge>
          {Object.entries(feedback.reasonCounts).map(([reason, count]) => (
            <Badge key={reason} variant="secondary">{REASON_LABELS[reason] ?? reason}: {count}</Badge>
          ))}
        </div>
      </CardHeader>
      {feedback.comments.length > 0 ? (
        <CardContent className="space-y-2 pt-0">
          {feedback.comments.map((comment, index) => (
            <div key={`${comment.createdAt}-${index}`} className="rounded-md border bg-background/80 p-3 text-sm">
              <p>{comment.text}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {comment.reasonCode ? `${REASON_LABELS[comment.reasonCode] ?? comment.reasonCode} · ` : ''}
                {new Date(comment.createdAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  )
}
