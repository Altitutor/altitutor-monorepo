import type { PropsWithChildren } from "react";
export function ApplePurchasesProvider({
  children,
}: PropsWithChildren<{ ready: boolean }>) {
  return children;
}
