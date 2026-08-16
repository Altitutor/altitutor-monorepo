import { DashboardPage } from "@/features/dashboard";
import { PaidCheckoutSuccessGate } from "@/features/subscription/components/paid-checkout-success-gate";
import { safePostAuthReturnPath } from "@/features/auth/lib/return-intent";

type DashboardRouteProps = {
  searchParams: Promise<{ checkout?: string; redirect?: string }>;
};

export default async function Page({ searchParams }: DashboardRouteProps) {
  const { checkout, redirect } = await searchParams;

  return (
    <PaidCheckoutSuccessGate
      active={checkout === "success"}
      returnPath={safePostAuthReturnPath(redirect)}
    >
      <DashboardPage />
    </PaidCheckoutSuccessGate>
  );
}
