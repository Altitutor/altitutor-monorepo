# UCAT iOS In-App Purchase launch

Implementation: DEV-531. Release tracking: DEV-324. Develop delivery does not enable production purchases or publish an App Store version.

## Approved product policy

- One Unlimited subscription group, with `com.altitutor.ucat.unlimited.weekly` and `com.altitutor.ucat.unlimited.monthly`.
- The owner approved matching the existing UCAT listing's 175 countries, using Apple's converted local prices from the Australian base. Future territories are not automatically enabled. Match website base prices of AUD15/week and AUD40/month to the closest Apple price points; record actual selected prices before making products available. No annual product, introductory trial, family-sharing offer or promotional offer is part of this launch. Do not merchandise out-of-app subscription offers: purchases require sign-in and appAccountToken binding. Disable Streamlined Purchasing when the approved StoreKit binary allows it ([Apple guidance](https://developer.apple.com/help/app-store-connect/manage-subscriptions/manage-streamlined-purchasing/)).
- Identical Unlimited learning access across web/iOS. Apple billing is fixed price; practice-day credits, founder-code discounts and referral billing rewards remain Stripe-specific. Existing website subscribers keep their terms and need not buy again.
- Apple manages its subscription-group changes and cancellations. There is no automatic migration between providers. Keep existing Stripe interval-lock and credit rules.

## Prepared App Store Connect drafts — 28 November 2026

- Subscription group `22634039`, reference name UCAT Unlimited.
- Weekly product Apple ID `6840278904`, product ID `com.altitutor.ucat.unlimited.weekly`, duration one week, exact Australian price AUD15.00.
- Monthly product Apple ID `6840280760`, product ID `com.altitutor.ucat.unlimited.monthly`, duration one month, exact Australian price AUD40.00.
- Both intervals provide the same service at group level1. English (Australia) group localization and product names/descriptions are saved. Both products cover the current 175 regions. App Store individual purchases only; multiseat purchasing, Apple Business, Apple School Manager, trials and family sharing are disabled.
- Products remain Prepare for Submission. The replacement verification key is securely stored in private local configuration and sensitive UCAT Vercel server variables (Production and this task's Preview branch); the unused original is revoked. Purchasing remains disabled in both deployments. Review screenshots and real sandbox verification are incomplete. Do not submit or enable production purchases based on these drafts alone.

## Server configuration

Configure these only in the appropriate server deployment's secret store, never Expo public variables or committed files:

- `UCAT_APPLE_IAP_PRIVATE_KEY`: Apple In-App Purchase server API signing key (PEM).
- `UCAT_APPLE_IAP_KEY_ID` and `UCAT_APPLE_IAP_ISSUER_ID`.
- `UCAT_APPLE_IAP_ENABLED=true` in the prepared private test deployment for sandbox verification, after its migration, products and approved test accounts are configured. Enable the production purchase flow only after the required sandbox verification passes.
- `UCAT_APPLE_SANDBOX_USER_IDS`: comma-separated Altitutor Auth UUIDs of approved review/test accounts only. Ordinary production accounts must not gain access from sandbox receipts. Do not include real customers merely to pass a test.
- Existing `CRON_SECRET` protects the hourly reconciliation route.

Bundle ID is `com.altitutor.ucat`; App Store app ID is `6817081340`. Trusted G2/G3 certificates are public files from Apple's certificate-authority site. Signature verification uses Apple's official server library with online checks, followed by a current App Store Server API status lookup. Client claims alone never grant access.

Configure App Store Server Notifications V2 (production and sandbox) to the deployed UCAT backend's `/api/ucat/apple/notifications`. The hourly `/api/cron/ucat-apple-subscriptions` route reconciles a bounded production batch, rotating attempted records independently of successful verification. Sandbox testing uses notifications and explicit restore. Check failed reconciliation counts and test-notification delivery before enabling purchases.

## Dedicated TestFlight sandbox build

The `iap-sandbox` EAS profile uses store distribution for TestFlight, Preview environment variables, and an isolated `iap-sandbox` update channel. Its public UCAT/Supabase connections are explicitly pinned to development, not production. Deploy the candidate backend/migration through the development CI/CD path before testing. Keep Apple server credentials out of the native build. This test build is not the final production binary; build the production profile after the sandbox gate passes.

## Required launch verification

1. Deploy through normal CI/CD; do not apply production SQL manually. Verify tables, restricted RPCs, scoped student view and shared access resolver. Preserve historical Stripe records.
2. Complete Apple paid-app agreements/tax/banking if required. An authorized human accepts any new legal agreement. Record subscription group, product IDs, exact prices, availability, no introductory offers and review metadata.
3. Install a new native iOS build (version1.1.5 runtime). Expo Go cannot exercise StoreKit. This is not an OTA-only change; do not send its bundle to the previous runtime. Android purchasing remains out of scope.
4. With approved sandbox accounts, verify purchase, restore after reinstall, account switching without transfer, app termination during purchase, cancellation through Apple, renewal, billing retry/grace, expiry, refund/revocation and notification replay/out-of-order delivery. Verify the same Altitutor account's access on web.
5. Verify iOS signup returns to the app without displaying the website Stripe plan picker, including login and incomplete-onboarding redirects. Verify existing Stripe subscriber access and practice discounts while answering in the app; neither client should offer a duplicate subscription. Test cancellation/unfinished checkout recovery across providers. An uncertain or pending Apple purchase retains its cross-provider reservation. The iOS clear-checkout action first attempts restore, then requires the user to confirm they cancelled with Apple and have no pending approval; it does not cancel Apple billing. A delayed Apple approval can still complete, so this is duplicate-purchase protection rather than an atomic transaction across Apple and Stripe. Do not claim a real store purchase based on synthetic database fixtures.
6. Verify web Apple billing management and account-deletion disclosure. Deleting the Altitutor account does not cancel an Apple renewal; deletion must remain available without requiring cancellation first. The durable Student/purchase binding is retained so restoring cannot transfer ownership.
7. Submit the subscription products with the new app build and give App Review a working dedicated demo account. Main promotion, signed upload, review approval and actual availability are separate release evidence.

Website Stripe tax configuration remains separate from Apple's storefront billing/tax handling. Confirm the existing Stripe Tax setup rather than assuming Apple configuration replaces it.

The UCAT-only `with-apple-iap-pod-uuids` config plugin guards the generated CocoaPods project against React Native 0.86 SPM UUID reuse, observed with ExpoIap. See [upstream RN fix](https://github.com/react/react-native/pull/57576); remove the workaround after a verified RN upgrade containing that fix. Native build verification includes reloading the Pods project and compiling the StoreKit module.
