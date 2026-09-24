# Separate session and portal-access request boundaries

Next.js middleware (renamed Proxy by newer Next.js versions) refreshes and verifies the Supabase session, copies every refreshed cookie and required no-cache response header, redirects missing sessions, and returns an instrumented retryable 503 when Auth is unavailable. It does not call PostgREST for roles, profiles, relationships, signup progress, or entitlements.

The initial protected Server Component boundary performs one caller-authenticated Portal access resolver read. AdminWeb and TutorWeb use the caller-scoped tutor profile facade. StudentWeb and UCAT Web use narrow app-specific RPCs so dual-role routing and signup state resolve in one round trip without granting base-table access. Request-scoped React memoization prevents duplicate server reads, and safe access data may hydrate user-scoped client queries. Layout access gates are user-experience routing only; API authorization, narrow write RPCs, and RLS remain authoritative.

Missing sessions redirect to login. A verified session whose access dependency fails is never treated as logged out or denied: it produces an instrumented unavailable experience. The exact PostgREST `PGRST303` / `JWT issued at future` clock-skew failure receives one one-second retry without weakening JWT validation; recovered and terminal outcomes are sent to Sentry. Persistent or production recurrence is a managed Supabase clock issue to escalate rather than bypass.

StudentWeb portal access continues to mean that the caller has a Student identity. Future in-person, online, or UCAT-origin onboarding is a separate Portal onboarding classification and must not be embedded in the session boundary.
