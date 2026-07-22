export const UCAT_SIGNUP_CONSENT_VERSION =
  "ucat-signup-marketing-v2-2026-07-22";

export const UCAT_SIGNUP_CONSENT_WORDING =
  "Email me optional personalised progress and study guidance, UCAT tips, product updates and offers. I can unsubscribe at any time.";

export const UCAT_PREFERENCE_CONSENT_VERSION =
  "ucat-communication-preferences-v1-2026-07-22";

export const UCAT_PREFERENCE_CONSENT_WORDING =
  "I chose which optional Altitutor UCAT emails I want to receive. I can change these preferences or unsubscribe at any time.";

export const UCAT_UNSUBSCRIBE_CONSENT_VERSION =
  "ucat-list-unsubscribe-v1-2026-07-22";

export const UCAT_UNSUBSCRIBE_CONSENT_WORDING =
  "Unsubscribe me from all optional Altitutor UCAT marketing emails.";

export const UCAT_COMMUNICATION_TOPICS = [
  "weekly_progress_and_guidance",
  "lessons_and_tips",
  "product_news",
  "offers_and_referrals",
] as const;

export type UcatCommunicationTopic =
  (typeof UCAT_COMMUNICATION_TOPICS)[number];

export type UcatCommunicationPreferences = Record<
  UcatCommunicationTopic,
  boolean
>;

export const DEFAULT_UCAT_COMMUNICATION_PREFERENCES: UcatCommunicationPreferences = {
  weekly_progress_and_guidance: false,
  lessons_and_tips: false,
  product_news: false,
  offers_and_referrals: false,
};

export function hasAnyUcatCommunicationPreference(
  preferences: UcatCommunicationPreferences,
): boolean {
  return UCAT_COMMUNICATION_TOPICS.some((topic) => preferences[topic]);
}
