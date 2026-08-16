---
id:
status: Ready to Implement
priority: High
estimate:
due:
labels: [ready-for-agent, imessage, admin-web]
linear_url:
branch:
codex_ready: true
grilled: true
better_at_computer: false
created: 2026-08-15
---

# Show Apple iMessage vs SMS on Mac-bridge messages

Obsidian issue tracker was not reachable from this agent. This spec lives in the repo until it can be copied into `Areas/Altitutor/Issues/`.

Triage: `ready-for-agent` / `Ready to Implement`. Grilled 2026-08-15. Related (separate, in progress on the Mac connector): first-contact DM create-then-send. That fix does not persist Apple service or change AdminWeb colours.

Staff-facing language is **SMS**, not Twilio. `TWILIO` remains the `owned_numbers.provider` enum only. The composer already groups those senders as SMS.

## Problem Statement

Staff send from AdminWeb on the dedicated Mac iMessage number. Some recipients are SMS-only. The Mac is fail-closed (Bridge ADR 0003): it refuses those Handles before send. Failed and Ambiguous still look like ordinary timestamps, `error_message` is hidden, and staff cannot recover the same body onto an SMS owned number without retyping and switching sender. Inbound Mac SMS is also invisible: every Mac-bridge bubble is blue (outbound) or muted (inbound), so mixed iMessage/SMS history on the Mac line is unreadable.

## Solution

Keep the Mac fail-closed. Persist Apple service on the Canonical message row. Paint Mac-line bubbles from that value (iMessage/unknown blue, SMS green). Make Failed and Ambiguous loud in the thread, with error text, and offer **Resend via SMS** onto the contact’s SMS conversation.

## User Stories

1. As an admin, I want inbound Mac-bridge SMS to show green, so that I know the contact is not on iMessage.
2. As an admin, I want inbound Mac-bridge iMessage to show blue, so that mixed history in the same thread is readable in both directions.
3. As an admin, I want outbound Mac-bridge iMessage (and unknown) to stay blue, so that successful iMessage still looks like iMessage.
4. As an admin, I want outbound SMS-owned-number bubbles to stay green, so that carrier SMS is not a new colour.
5. As an admin, I want inbound SMS-owned-number bubbles to stay muted, so that this spec does not recolour the SMS conversation’s inbound side.
6. As an admin, I want Apple service to fill if a later event for that GUID reports `SMS` or `iMessage`, so that colour matches the final transport when an event already lands.
7. As an admin, I want a known Apple service to stay put if a later delivery/read event omits service, so that colour does not flicker to unknown.
8. As an admin, I want historical Mac-bridge rows with no stored Apple service to stay blue, so that old threads do not change colour when the column is added.
9. As an admin, I want Failed outbound Mac-bridge messages to be visually loud, so that I do not mistake them for delivered.
10. As an admin, I want Ambiguous outbound Mac-bridge messages to be visually loud and distinct from Failed, so that I know acceptance is unknown and must not retry on the Mac.
11. As an admin, I want the Apple/BlueBubbles `error_message` on Failed and Ambiguous bubbles, so that I can tell “not iMessage-capable” from a missing chat from other failures.
12. As an admin, I want one-click **Resend via SMS** on a Failed Mac-bridge row, so that the recipient still gets the text.
13. As an admin, I want **Resend via SMS** on Ambiguous only after a confirm that the Mac may still deliver, so that I do not duplicate on a second channel by accident.
14. As an admin, I want that resend to create a new outbound on the contact’s SMS conversation (created if needed), so that the Canonical store keeps both attempts.
15. As an admin, I want the original Failed/Ambiguous Mac-bridge row to remain, so that we do not pretend the Mac send succeeded.
16. As an admin, I want the SMS resend to use the default PHONE SMS owned number, so that recovery is one click and does not use alphanumeric `ALTITUTOR`.
17. As an admin, I want Resend via SMS to send the text body only, so that we do not invent SMS media for this spec. If there is no text, the action is disabled.
18. As an admin, I want the owned-number filter cleared after resend, so that the new SMS bubble is visible in the thread I am looking at.
19. As an admin, I want the composer switched to that SMS number for this contact visit, so that the next typed send is not another fail-closed Mac failure.
20. As an admin, I want Resend via SMS spent after the SMS row is queued, and available again if that SMS send fails, so that one click cannot double-queue and a failed SMS can be retried.
21. As an admin, I want group iMessage to stay blue with no Resend via SMS, so that groups are not treated as SMS DMs.
22. As an admin, I want SMS-only first contact on the Mac to fail closed, so that we do not send Mac SMS that later fails because the iPhone is away.
23. As an admin, I want Messaging settings Failed/Ambiguous commands to remain the operational list, so that thread colouring is not the only signal.
24. As an admin, I want read/delivered receipts on iMessage to keep working independently of colour.
25. As a connector, I want inbox events to keep carrying Apple service from BlueBubbles, so that the Canonical store can persist it.
26. As a developer, I want owned-number provider (`TWILIO` vs `IMESSAGE`) kept distinct from Apple service (`iMessage` vs `SMS`), so that we stop using one field for two meanings.
27. As a developer, I want this work not to change first-contact chat creation, so that the Mac create-then-send fix can ship separately.

## Implementation Decisions

Settled from current code and production:

- AdminWeb bubble colour today is owned-number provider: SMS (`TWILIO`) outbound green, Mac iMessage line always blue. Inbound is always muted. Nothing reads Apple service.
- The Connector already normalizes BlueBubbles `service` and posts `Service` on the inbound webhook.
- Inbox event processing does not persist `Service`. `messages` has no Apple-service column.
- Failed, Ambiguous, and `error_message` are stored. The thread shows status as 9px muted text and does not show `error_message`.
- `REQUIRE_IMESSAGE=true` (Bridge ADR 0003) refuses green-bubble Handles before send (`422` / `NOT_IMESSAGE`). Cloud never sets `allowSms` on `send_message`. **Do not reopen that ADR.**
- Conversations are unique per `(contact, owned_number)` while OPEN/SNOOZED. The contact thread already merges them unless filtered by owned number.
- SMS send posts body only (no media). Composer `selectedSenderId` is local state and resets to `is_default` on remount.
- Production has a PHONE SMS owned number that already works, plus alphanumeric `ALTITUTOR`. Look the PHONE SMS number up at runtime; do not hardcode E.164.

Grilled:

- **Mac SMS policy:** fail-closed. Staff recover on an SMS owned number. Outbound Mac SMS is not a v1 success path, so outbound Mac bubbles stay blue.
- **Canonical field:** new `messages.apple_service` (`iMessage` / `SMS`; NULL = unknown). Inbox processing writes webhook `Service`. Chat GUID prefix (`iMessage;-;` / `SMS;-;`) is fallback only when `Service` is omitted. Delivery and reconciliation events may fill NULL → known; they must not regress a known value. No batch backfill of historical rows. If an event for that GUID already lands and has service, write it.
- **Unknown / historical colour:** one paint rule. Mac-line + NULL or `iMessage` → blue. Mac-line + `SMS` → green. Old threads stay blue until an event fills service.
- **SMS owned-number colour:** outbound stays green (provider). Inbound stays muted.
- **Failure UX:** loud Failed vs Ambiguous vs Sent (colour/weight of status, not the bubble). Show `error_message`. Bubble colour stays the transport colour.
- **Resend via SMS:** Failed one-click; Ambiguous with confirm (Mac may still deliver). New outbound on the SMS conversation. Original Mac row unchanged. Default among **PHONE** SMS owned numbers (`sender_type = 'PHONE'`, `provider = 'TWILIO'`); skip alphanumeric; disable if none exist.
- **Attachments:** body only. Disable when there is no text (attachment-only).
- **After resend:** clear the owned-number filter; set composer to that SMS number for this contact visit only. No per-contact remembered sender.
- **Once:** `messages.resent_from_message_id` on the SMS row (FK to the Mac row). Not unique. Spent while a linked SMS row exists whose status is not `FAILED` or `UNDELIVERED`. Re-enable if that SMS send fails. A retry after SMS failure inserts another linked row.
- **Groups:** no SMS colouring, no Resend via SMS.

Seams:

- **Canonical:** inbox event processing writes `apple_service` onto the message row. Resend inserts a normal SMS outbound with `resent_from_message_id` set, using the existing send-message path (no new Mac send path).
- **AdminWeb:** the message thread derives bubble colour from `apple_service` when the owned number is the Mac iMessage line, and from owned-number provider for outbound when the owned number is SMS. Failed/Ambiguous presentation and Resend via SMS live in the same thread component.

Transport observation belongs in the Canonical store after the Connector reports it.

## Testing Decisions

- Good tests observe stored `apple_service`, `resent_from_message_id`, and thread colour/status from public fixtures, not BlueBubbles internals.
- Inbox event tests: `Service: "SMS"` on a Mac-line event persists `SMS`; omitted service does not overwrite a known value; Chat GUID fallback fills NULL only; SMS-provider (`TWILIO`) messages do not get `apple_service` from this path.
- AdminWeb tests: Mac-line + `SMS` → green; Mac-line + `iMessage` → blue; Mac-line + NULL → blue; SMS owned outbound → green; Failed and Ambiguous are distinguishable from Sent and from each other; Resend via SMS inserts a linked SMS outbound and spends the action until that SMS row fails.
- Prior art: `supabase/functions/_shared/__tests__/imessage.test.ts` for inbound contracts; `apps/admin-web/src/features/messages` component tests for thread presentation.

## Out of Scope

- First-contact DM chat creation on the Mac (`chat/new` before `message/text`). Separate connector fix.
- Reopening Bridge ADR 0003 or setting `allowSms` from the cloud.
- Changing SMS send, alphanumeric sender IDs, or group-chat membership.
- SMS media / MMS for Resend via SMS.
- Auto-failover from Mac failure to SMS without a staff action.
- A one-shot backfill of historical `apple_service` from `imessage_events`.
- Per-contact remembered default sender.
- Exposing BlueBubbles or Bridge ports publicly.

## Further Notes

Grill dropped outbound Mac-SMS colouring as a goal: fail-closed means those sends should not succeed. v1 is inbound Apple-service colour, loud Failed/Ambiguous, and staff-initiated Resend via SMS.
