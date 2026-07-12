import { DashboardPage } from "@/features/dashboard";
import { PaidCheckoutSuccessGate } from "@/features/subscription/components/paid-checkout-success-gate";

type DashboardRouteProps = {
  searchParams: Promise<{ checkout?: string }>;
};

export default async function Page({ searchParams }: DashboardRouteProps) {
  const { checkout } = await searchParams;

  return (
    <PaidCheckoutSuccessGate
      active={checkout === "success"}
      returnPath="/dashboard"
    >
      <DashboardPage />
    </PaidCheckoutSuccessGate>
  );
}
