import { PRODUCT_LINKS } from "@/lib/site";

export type PrimaryAction = { href: string; label: string };

// Add a reviewed destination here when its signup flow is available.
// Article destination keys and validation are derived from this catalogue.
export const conversionActions = {
  "trial-session": {
    href: PRODUCT_LINKS.trialBooking,
    label: "Book a free trial session",
    navigationLabel: "Free trial",
    heading: "Take the next step with a tutor",
    description:
      "Book a free trial session to find the right support for your studies.",
  },
  "ucat-signup": {
    href: PRODUCT_LINKS.ucatSignup,
    label: "Start UCAT practice for free",
    navigationLabel: "Start free",
    heading: "Put your UCAT preparation into practice",
    description:
      "Create your Altitutor UCAT account and start practising for free.",
  },
} as const;

export type ConversionTarget = keyof typeof conversionActions;

export function isConversionTarget(value: unknown): value is ConversionTarget {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(conversionActions, value)
  );
}
