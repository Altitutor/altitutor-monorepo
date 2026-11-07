"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Button, InterviewReviewMockHistory, RichTextEditor, type JSONContent } from "@altitutor/ui";
import { studentBtnIconOutline, studentBtnOutline, studentCardCn } from "@/shared/lib/student-visual";
import { ResourcesBreadcrumb } from "@/features/resources/components/resources-breadcrumb";
import { useInterviewAccess } from "../hooks/use-interviews";
import { StudentInterviewListCard } from "./student-interview-list-card";
import { formatInterviewReviewDate as reviewDate, performanceReviewPath as reviewRoot } from "@altitutor/shared";
import { useStudentInterviewReview, useStudentInterviewReviews } from "../hooks/use-interview-performance-reviews";
import { interviewResultsHref } from "../lib/routes";
import { InterviewError } from "./interview-error";

const interviewCrumb = { label: "Interviews", href: "/interviews" };
const reviewCrumb = { label: "Performance reviews", href: reviewRoot };

export function StudentPerformanceReviewsPage({ reviewId, revision }: { reviewId?: string; revision?: string }) {
  const access = useInterviewAccess();
  const allowed = access.data?.hasAccess === true;
  const list = useStudentInterviewReviews(allowed && !reviewId);
  const detail = useStudentInterviewReview(reviewId, allowed, revision);
  const query = reviewId ? detail : list;
  const review = detail.data;
  if (access.error) return <InterviewError error={access.error} retry={() => void access.refetch()} />;
  if (access.isPending) return <p className="py-8" role="status">Loading performance reviews…</p>;
  if (!allowed) return <p className="py-8">An active Medicine interview enrolment is required to view performance reviews.</p>;
  if (query.isPending) return <p className="py-8" role="status">Loading performance reviews…</p>;
  const unavailable = query.error && "status" in query.error && query.error.status === 404;
  if (query.error && !unavailable) return <InterviewError error={query.error} retry={() => void query.refetch()} />;
  if (reviewId && !review) return (
    <section className="space-y-3 py-8">
      <h1 className="text-2xl font-semibold">Performance review unavailable</h1>
      <Button asChild variant="outline"><Link href={reviewRoot}>Back to performance reviews</Link></Button>
    </section>
  );
  if (review) {
    const rounds = review.mocks;
    return (
      <div className="py-8">
        <ResourcesBreadcrumb items={[interviewCrumb, reviewCrumb, { label: "Review" }]} />
        <header className="mb-6 flex items-start gap-3">
          <Button asChild variant="outline" size="icon" className={studentBtnIconOutline}><Link href={reviewRoot} aria-label="Back to performance reviews"><ArrowLeft className="size-4" /></Link></Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{review.title || "Performance review"}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{reviewDate(review.date)} · {review.author}</p>
          </div>
        </header>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(290px,36%)]">
          <article className="min-w-0" aria-label="Performance review document">
            <RichTextEditor allowMedia={false} content={review.body as JSONContent} editable={false} autoHeight />
          </article>
          <aside className={studentCardCn("space-y-3 p-4 ring-0 lg:sticky lg:top-4")} aria-label="Mock scores at this review">
            <header>
              <h2 className="font-semibold">Mock scores</h2>
              <p className="text-sm text-muted-foreground">Through {reviewDate(review.date)}</p>
            </header>
            {rounds.length ? rounds.map((round) => <InterviewReviewMockHistory key={round.id} round={round} resultHref={interviewResultsHref(round.id)} resultButtonClassName={studentBtnOutline} />) :
              <p className="text-sm text-muted-foreground">No released mocks by this review date.</p>}
          </aside>
        </div>
      </div>
    );
  }
  return (
    <div className="py-8">
      <ResourcesBreadcrumb items={[interviewCrumb, reviewCrumb]} />
      <header className="mb-6">
        <h1 className="text-3xl font-semibold tracking-tight">Performance reviews</h1>
        <p className="mt-1 text-muted-foreground">Read your tutor’s feedback, practice priorities, and next steps.</p>
      </header>
      {!list.data?.length && <p className="text-sm text-muted-foreground">You don’t have any published performance reviews yet.</p>}
      <ul className="space-y-3">
        {[...(list.data ?? [])].sort((a, b) => b.date.localeCompare(a.date)).map((item) => (
          <li key={item.id}>
            <StudentInterviewListCard href={reviewRoot + "/" + item.id} icon={FileText}
              title={item.title || "Performance review"} description={reviewDate(item.date) + " · " + item.author} />
          </li>
        ))}
      </ul>
    </div>
  );
}
