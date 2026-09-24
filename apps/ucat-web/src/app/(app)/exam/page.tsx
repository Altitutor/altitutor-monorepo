import { ExamRoutePage } from "@/features/exam-experience/components/exam-route-page";
import { PaidCheckoutSuccessGate } from "@/features/subscription/components/paid-checkout-success-gate";

type ExamRouteProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function ExamRoute({ searchParams }: ExamRouteProps) {
  const { checkout } = await searchParams;

  return (
    <PaidCheckoutSuccessGate active={checkout === "success"} returnPath="/exam">
      <ExamRoutePage />
    </PaidCheckoutSuccessGate>
  );
}
