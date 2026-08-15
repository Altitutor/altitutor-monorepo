---
id:
status: Needs Grill
priority: High
estimate:
due:
labels: [needs-info, imessage, admin-web]
linear_url:
branch:
codex_ready: false
grilled: false
better_at_computer: false
created: 2026-08-15
---

# Show Apple iMessage vs SMS on Mac-bridge messages

Obsidian issue tracker was not reachable from this agent. This spec lives in the repo until it can be copied into `Areas/Altitutor/Issues/`.

Triage: `needs-info` / `Needs Grill`. Open decisions are listed under Implementation Decisions. Do not implement until grilled.

Related (separate, in progress on the Mac connector): first-contact DM create-then-send. That fix does not persist Apple service or change AdminWeb colours.

## Problem Statement

Staff send from AdminWeb on the dedicated Mac iMessage number. Some recipients are SMS-only (green bubble). SMS from that Mac also fails when the phone with the SMS-capable SIM is not nearby. Today every Mac-bridge bubble is blue, Failed and Ambiguous look like ordinary timestamps, and staff cannot tell whether Apple sent iMessage or SMS — so they cannot see a failed SMS and retry from a Twilio owned number.

## Solution

AdminWeb should show the Apple transport Messages.app actually used: iMessage blue, SMS green. Failed and Ambiguous sends should be obvious, with enough detail that staff can resend the same body from a Twilio owned number. The Canonical store must remember Apple service, not infer it from which owned number was selected.

## User Stories

1. As an admin, I want a Mac-bridge SMS bubble to be green, so that I can see it did not go as iMessage.
2. As an admin, I want a Mac-bridge iMessage bubble to stay blue, so that successful iMessage still looks like iMessage.
3. As an admin, I want inbound Mac-bridge SMS from a contact to show green, so that I know they are not on iMessage.
4. As an admin, I want inbound iMessage to stay distinct from inbound SMS in the same contact thread, so that mixed history is readable.
5. As an admin, I want Twilio-owned-number bubbles to stay green, so that carrier SMS is not confused with a new colour.
6. As an admin, I want Apple service to update if Messages.app later reports SMS after a pending send, so that the bubble colour matches the final transport.
7. As an admin, I want Apple service to remain iMessage if a later delivery/read event does not include service, so that colour does not flicker to unknown.
8. As an admin, I want Failed outbound Mac-bridge messages to be visually loud, so that I do not mistake them for delivered.
9. As an admin, I want Ambiguous outbound Mac-bridge messages to be visually loud and distinct from Failed, so that I know acceptance is unknown and must not blindly resend on the Mac.
10. As an admin, I want the Apple/BlueBubbles error text on Failed and Ambiguous bubbles, so that I can tell SMS-proximity failure from “not iMessage-capable” from a missing chat.
11. As an admin, I want to copy or resend a failed Mac-bridge body via a Twilio owned number, so that the recipient still gets the text when the Mac cannot SMS.
12. As an admin, I want resend-via-Twilio to create a new outbound message on the Twilio conversation, so that the Canonical store keeps an audit trail of both attempts.
13. As an admin, I want the original Failed/Ambiguous Mac-bridge row to remain, so that we do not pretend the Mac send succeeded.
14. As an admin, I want group iMessage to stay blue and not offer SMS colouring, so that group chats are not treated as green-bubble DMs.
15. As an admin, I want SMS-only first contact to fail closed when Mac SMS is disallowed, so that we do not silently send green bubbles that later fail because the iPhone is away.
16. As an admin, I want SMS-only first contact to send as SMS and show green when Mac SMS is allowed, so that Android / non-iMessage parents can still be reached from the Mac when the phone is nearby.
17. As an admin, I want a clear Failed status when Mac SMS is attempted and the iPhone is not nearby, so that I switch to Twilio instead of retrying the Mac.
18. As an admin, I want Messaging settings Failed/Ambiguous commands to remain the operational list, so that colouring in the thread is not the only signal.
19. As an admin, I want historical Mac-bridge messages without stored Apple service to have a defined colour, so that old threads do not look broken after the column is added.
20. As an admin, I want read/delivered receipts on iMessage to keep working independently of colour, so that transport display does not regress delivery state.
21. As a connector, I want inbox events to carry Apple service from BlueBubbles, so that the Canonical store does not have to guess from Chat GUID.
22. As a connector, I want reconciliation-message events to backfill Apple service when the live webhook omitted it, so that catch-up repairs colour as well as body.
23. As a developer, I want owned-number provider (Twilio vs Mac iMessage line) kept distinct from Apple service (iMessage vs SMS), so that we stop using one field for two meanings.
24. As a developer, I want this work not to change first-contact chat creation, so that the Mac create-then-send fix can ship without this grill.

## Implementation Decisions

Settled from current code and production (not open):

- AdminWeb bubble colour today is owned-number provider: Twilio green, Mac iMessage line always blue. It does not read Apple service.
- The Connector already normalizes BlueBubbles `service` and posts `Service` on the inbound webhook.
- Inbox event processing does not persist `Service`. `messages` has no Apple-service column.
- Failed, Ambiguous, and `error_message` are stored. The thread shows status as 9px muted text and does not show `error_message`.
- `REQUIRE_IMESSAGE=true` (Bridge ADR 0003) refuses green-bubble handles before send (`422` / not iMessage-capable). Cloud never sets `allowSms` on `send_message`.
- Mac SMS requires the SMS-capable iPhone nearby (Continuity). iMessage from the Mac does not.
- Contradicts Bridge ADR 0003 if we allow Mac SMS fallback. That ADR is the reason silent SMS exists as a reliability problem. Reopening it is a grill outcome, not a silent override.

Open — grill before implement:

1. **Mac SMS policy.** Keep fail-closed (SMS-only → Failed, staff use Twilio), or allow Mac SMS when the iPhone is nearby and colour those bubbles green?
2. **Canonical field.** New `messages` column for Apple service (`iMessage` / `SMS` / unknown), vs parse Chat GUID (`iMessage;-;` / `SMS;-;`), vs JSON on the inbox event only.
3. **When service is unknown.** Colour as blue (today’s Mac default), grey, or hide until a webhook supplies service?
4. **Historical rows.** Leave unknown, backfill from `imessage_events` raw payloads, or treat missing as iMessage?
5. **Failure UX.** Colour/status only, or also a thread action “Resend via Twilio”?
6. **Resend-via-Twilio shape.** New message on the existing Twilio conversation for that contact; prompt to pick a Twilio owned number; or one-click default Twilio sender.
7. **Ambiguous vs Failed.** Ambiguous must not auto-retry on the Mac (duplicate risk). May staff still one-click Twilio resend for Ambiguous, or only for Failed?

Proposed seams (confirm in grill; do not write tests against unconfirmed seams):

- **Canonical seam:** inbox event processing writes Apple service onto the message row from webhook `Service` (and Chat GUID as fallback). Delivery / reconciliation events may fill unknown → known monotonically (`SMS`/`iMessage` win over unknown; do not regress a known service).
- **AdminWeb seam:** the message thread derives bubble colour from Apple service when the owned number is the Mac iMessage line, and from owned-number provider when the owned number is Twilio. Failed/Ambiguous presentation is part of the same thread component.

Do not add per-composer AdminWeb send paths. Transport observation belongs in the Canonical store after the Connector reports it.

## Testing Decisions

- Good tests observe stored Apple service and thread colour/status from public fixtures, not BlueBubbles internals.
- Inbox event tests: `Service: "SMS"` on a Mac-line outbound event persists SMS; omitted service does not overwrite a known value; Twilio messages are unchanged.
- AdminWeb tests: Mac-line + SMS → green; Mac-line + iMessage → blue; Twilio → green; Failed/Ambiguous are distinguishable from Sent.
- Prior art: `supabase/functions/_shared/__tests__/imessage.test.ts` for inbound contracts; `apps/admin-web/src/features/messages` component tests for thread presentation.

## Out of Scope

- First-contact DM chat creation on the Mac (`chat/new` before `message/text`). Separate connector fix.
- Changing Twilio send, alphanumeric sender IDs, or group-chat membership.
- Auto-failover from Mac SMS to Twilio without a staff action.
- Exposing BlueBubbles or Bridge ports publicly.
- Colouring inbound vs outbound differently except as Apple service already implies.

## Further Notes

Grill should start from Mac SMS policy (decision 1). Colouring green is only meaningful if Mac SMS is allowed to succeed. Fail-closed plus louder Failed/Ambiguous plus Twilio resend may be enough even if Mac bubbles stay blue.

Suggested first grill round: policy (1), then whether Twilio resend is in v1 (5–7). Field/unknown/history (2–4) hang off those.
