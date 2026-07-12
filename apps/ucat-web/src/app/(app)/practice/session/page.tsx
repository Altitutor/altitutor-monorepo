import { PracticeSessionPage } from "@/features/practice/components/practice-session-page";
import { PaidCheckoutSuccessGate } from "@/features/subscription/components/paid-checkout-success-gate";

type PracticeSessionRouteProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function PracticeSessionRoute({
  searchParams,
}: PracticeSessionRouteProps) {
  const { checkout } = await searchParams;

  return (
    <PaidCheckoutSuccessGate
      active={checkout === "success"}
      returnPath="/practice/session"
    >
      <PracticeSessionPage />
    </PaidCheckoutSuccessGate>
  );
}
