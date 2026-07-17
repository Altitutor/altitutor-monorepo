# iMessage domain

## Glossary

- **Canonical store**: Supabase rows are the durable truth used by staff applications.
- **Connector**: The process on the dedicated Mac that pulls commands and emits events.
- **Command**: One durable requested side effect in `imessage_commands`.
- **Inbox event**: A replay-safe raw Mac event in `imessage_events`.
- **Provider GUID**: The stable GUID assigned by Messages.app.
- **Temp GUID / correlation**: The command UUID carried through a send and callback.
- **Ambiguous send**: Provider acceptance may have happened, but no definitive result is available.
- **Staff read state**: Per-staff UI state in `conversation_reads`.
- **iMessage read command**: An explicit request to alter Messages.app chat read state.

## Command lifecycle

`queued → claimed → succeeded`

`queued → claimed → failed`

`queued → claimed → ambiguous`

`queued → claimed → queued` is allowed only for bounded, explicitly retryable, non-send operations
where the connector confirms there was no provider acceptance. `ambiguous` is terminal and requires
reconciliation or human action. Commands may also become `cancelled`.

Claiming increments `attempts` and binds the command to `claimed_by`. Completion is accepted only
from that connector. A bounded exponential delay controls safe retries. A five-minute expired
claim can be reclaimed only for the explicitly safe read/alert operations; all other expired
claims become `ambiguous` so uncertain provider acceptance cannot cause a duplicate side effect.

## Outbound message lifecycle

`QUEUED → SENT → DELIVERED → READ`

`QUEUED → FAILED` means a send failed before provider acceptance.

`QUEUED/SENDING → AMBIGUOUS` means acceptance cannot be determined. A later event correlated by
GUID or temp GUID can advance it to `SENT`, `DELIVERED`, or `READ`.

Transitions are monotonic: a late `SENT` event cannot regress `DELIVERED` or `READ`. Provider error
events cannot overwrite a known delivered/read result.

## Inbound and reconciliation events

`new-message` and `reconciliation-message` are message-producing events. Both are idempotent by
provider GUID and can correlate an existing outbound row by temp GUID.

`message-send-error` updates a correlated outbound row. Group-name and participant events update
conversation metadata. Typing and server events are stored in the durable inbox but never inserted
as messages. Read events update provider message state only; they do not change `conversation_reads`.

Every authenticated event is inserted into `imessage_events` before processing. A repeated
`event_key` resumes an unprocessed event or returns as an already-processed duplicate. Attachments
are unique by `(message_id, storage_url)`.

## Connector HTTP contract

`POST imessage-connector` uses `Authorization: Bearer <CONNECTOR_SECRET>`.

- `{"action":"claim","connectorId":"...","limit":10}` returns `commands`.
- `{"action":"complete","connectorId":"...","commandId":"...","outcome":"succeeded|failed|ambiguous","result":{},"error":null}`
  completes or safely requeues a command.
- `{"action":"heartbeat","connectorId":"...","status":{"bluebubblesConnected":true,"privateApiConnected":true,"webhookRegistered":true,"outbox":{...},...}}`
  derives health and stores only sanitized capabilities, booleans, counts, and timestamps.

Claimed commands are `{id,type,payload,attempts}`. For `send_message`, `payload` includes `text`,
`to` or `chatId`, `mediaUrls`, reply GUID, and the command ID as correlation/temp GUID.

## Administrative controls

`imessage-control` requires a normal authenticated JWT. It validates structured input and invokes
`enqueue_imessage_command`, which independently verifies active `ADMINSTAFF`. Destructive actions
require a reason and are attributed to `requested_by_staff_id`. Direct browser inserts into command,
event, and connector-state tables are denied.

## Production rollout

Deploy in this order so the existing message path is not interrupted:

1. CI applies `20260717075000_imessage_durable_connector.sql`.
2. CI deploys `imessage-inbound`, `imessage-connector`, `imessage-control`, `send-message`, and the
   retired `sync-imessage-history` response.
3. Configure `IMESSAGE_WEBHOOK_SECRET`. Prefer a separate `CONNECTOR_SECRET`; during rollout the
   connector falls back to `IMESSAGE_WEBHOOK_SECRET` when the dedicated secret is absent.
4. Configure the dedicated Mac bridge with the matching secrets plus
   `CONNECTOR_URL=https://<project>.supabase.co/functions/v1/imessage-connector` and a stable
   `CONNECTOR_ID`, then rebuild and restart it.
5. Confirm the bridge `/messages/readyz` response, a fresh connector heartbeat in Messaging
   settings, one outbound canary message, its delivery/read progression, and one inbound reply.

Do not enable the Mac connector before the migration and functions are live. Do not expose the
bridge or BlueBubbles ports publicly.
