import { FeedbackShell } from '@/features/feedback/components/FeedbackShell';

export default function FeedbackLayout({ children }: { children: React.ReactNode }) {
  return <FeedbackShell>{children}</FeedbackShell>;
}
