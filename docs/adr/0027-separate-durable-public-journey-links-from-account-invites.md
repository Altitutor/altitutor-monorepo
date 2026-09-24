# Separate durable public journey links from account invites

Altitutor will use independent, durable bearer links for In-person registration and public booking management instead of reusing single-use account-invite tokens or internal record IDs. Each Student owns one stable registration public token and each public booking Session owns one stable booking public token; normal sends reuse it, explicit ADMINSTAFF revocation rotates it, and terminal journeys continue to resolve to minimal state-appropriate pages. Account invites remain independent single-use credentials, while legacy registration UUIDs and booking Session-ID URLs remain supported through compatibility routes.

## Considered options

Reusing `invite_token` was rejected because completing either account invitation or In-person registration invalidates the other journey. A generic polymorphic public-links table was rejected because registration and booking each have one clear owner and lifecycle, so ownership-aligned columns provide a smaller interface and fewer failure modes. Per-message tokens were rejected because resending would invalidate or proliferate customer links.

## Consequences

New customer-facing URLs use short high-entropy tokens at `/r/{token}` and `/b/{token}`. Possession authorizes an actionable journey without an OTP; completed, cancelled, unavailable, or revoked journeys expose only minimal state. Runtime-specific URL adapters choose the appropriate student portal while sharing the same path contract, and production remains the fallback when hosted configuration is absent.
