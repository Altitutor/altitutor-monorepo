# UCAT notifications E2E runbook

Run these checks after applying `20260712082555_unify_app_scoped_notifications.sql` and deploying UCAT web, the activity processor, and Stripe webhooks to the same development environment.

## Inbox and app isolation

- [ ] The bell appears beside the theme and profile controls outside immersive exam/practice routes.
- [ ] Opening the tray refetches the inbox and shows loading, empty, error, unread, and read states truthfully.
- [ ] The unread badge, individual read action, and **Mark all read** remain correct after refresh.
- [ ] An expired or resolved notification is absent from the active tray.
- [ ] A `student_web` notification appears in student-web but not UCAT web.
- [ ] A `ucat_web` notification appears in UCAT web but not student-web.
- [ ] Reusing a producer `dedupe_key` creates only one inbox item.

## Referral and quota events

- [ ] Referral signup creates one bundled notice for the referrer and one for the referred student.
- [ ] Both notices mention the Free quota reset; no separate duplicate reset notice is produced.
- [ ] A paid referral creates one **Your next bill is free** notice for each reward recipient.
- [ ] An admin quota reset creates a UCAT notice for the affected student.
- [ ] The first blocked action in a quota period creates one area-specific limit notice.
- [ ] Repeated blocked requests in the same area and quota period do not create duplicates.
- [ ] A new quota period may create a new notice.

## Billing events

- [ ] A UCAT `invoice.payment_failed` event creates one critical payment notice linked to subscription settings and a persistent header warning.
- [ ] Retrying the same Stripe event or failing the same invoice again does not duplicate the notice.
- [ ] `invoice.payment_action_required` changes the same recovery notice to authentication-specific copy rather than creating a duplicate.
- [ ] `invoice.updated` refreshes the displayed next-attempt time when Stripe supplies one.
- [ ] Paying that exact invoice sets `resolved_at`, clears only its recovery state, removes the warning, and creates one lightweight recovery notice.
- [ ] A delayed paid event for an older invoice does not clear a newer invoice's failure.
- [ ] `invoice.finalization_failed` creates a separate critical billing-details notice; successful finalization resolves it.
- [ ] Exhausted retries ending in `canceled` or `unpaid` produce one terminal notice and one terminal email, then show the Free plan without deleting history.
- [ ] A non-UCAT subscription invoice does not create a UCAT notification.

## Admin automation

- [ ] A notification action can target **UCAT app** and **All UCAT Students**.
- [ ] Student, staff and UCAT destinations are routed to their respective app surfaces.
- [ ] Replaying an activity event does not duplicate its automation notification.
- [ ] Content releases are announced explicitly as one meaningful batch/set notification, not once per approved question stem.

## Polling behavior

- [ ] The inbox refetches when opened, once per minute while the app is active, and when the window regains focus.
- [ ] No WebSocket or Supabase Realtime subscription is required.
