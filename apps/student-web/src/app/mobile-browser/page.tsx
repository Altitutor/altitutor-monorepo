import { BrowserSessionReturn } from "@/features/auth/components/browser-session-return";

export const metadata = { referrer: "no-referrer" as const };

export default function MobileBrowser() {
  return <BrowserSessionReturn />;
}
