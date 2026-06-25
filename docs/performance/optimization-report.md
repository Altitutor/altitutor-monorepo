# Performance Optimization Report

Date: 2026-06-25

## Changed Files

Middleware:
- `apps/marketing-web/src/middleware.ts`
- `apps/student-web/src/middleware.ts`
- `apps/tutor-web/src/middleware.ts`
- `apps/admin-web/src/middleware.ts`
- `apps/ucat-web/src/middleware.ts`

Realtime and query invalidation:
- `apps/admin-web/src/shared/hooks/useSupabaseRealtimeInvalidation.ts`
- `apps/admin-web/src/features/activity/hooks/useActivityEvents.ts`
- `apps/admin-web/src/features/notes/api/queries.ts`
- `apps/admin-web/src/features/notes/api/dailyQueries.ts`
- `apps/admin-web/src/shared/hooks/useNotes.ts`
- `apps/admin-web/src/features/notes/hooks/useDocumentEditLock.ts`
- `apps/admin-web/src/features/messages/components/MessageThread.tsx`

Notification batching:
- `apps/student-web/src/app/api/notifications/route.ts`
- `apps/student-web/src/features/notifications/api/notifications.ts`
- `apps/student-web/src/features/notifications/api/mutations.ts`
- `apps/student-web/src/features/notifications/components/NotificationsTray.tsx`
- `apps/tutor-web/src/app/api/notifications/route.ts`
- `apps/tutor-web/src/features/notifications/api/notifications.ts`
- `apps/tutor-web/src/features/notifications/api/mutations.ts`
- `apps/tutor-web/src/features/notifications/components/NotificationsTray.tsx`

Docs and migration proposals:
- `docs/performance/realtime-audit.md`
- `docs/performance/optimization-report.md`
- `supabase/migrations/20260625042338_performance_realtime_publication_proposal.sql`

## Expected Vercel CPU Impact

Middleware invocation volume should drop for all five web apps because matchers now exclude Next static assets, optimized images, favicon, robots, sitemap, `.well-known`, and common static file extensions.

Marketing-web now has an explicit matcher while preserving the `.vercel.app` `X-Robots-Tag: noindex, nofollow` behavior.

Student-web returns before creating a Supabase SSR client on public paths. Tutor-web now skips `supabase.auth.getUser()` on public paths and API routes after creating the client for cookie refresh. UCAT-web moves pricing/public-path classification before Supabase client setup and auth calls.

## Expected Supabase Impact

Realtime:
- Fixed a `MessageThread` channel leak where async subscription cleanup was not returned to React.
- Added `enabled` gating to admin Realtime invalidation so notes, daily notes, detail rows, and edit-lock subscriptions do not open before the relevant UI/entity is active.
- Removed Realtime from admin activity feed hooks because activity events do not need live updates.
- Kept Realtime for admin issues, projects, tasks, and notes because those pages should show other users' changes without reload.
- Added debounced invalidation for issues, issue tags, projects, tasks, notes, and note folders.
- Added a Realtime audit and a guarded migration to remove only `activity_events` from the Realtime publication through the normal reviewed migration flow.

Notifications:
- Student and tutor notification trays now mark dismissed notifications read in one request instead of one PATCH per notification.
- Authorization is preserved by verifying the current student/tutor through the user-scoped client before performing a service-role update constrained by profile id and notification ids.

## Query Hotspots

Exact counts remain where they appear to drive visible count/quota behavior. No broad count removals were made without UI confirmation.

Recommended EXPLAIN ANALYZE targets before SQL changes:
- `get_available_slots(...)`
- `search_files_admin(...)`
- `vadmin_reconciliation_*` views
- admin conversations list and message ID-array lookup queries
- unread notification count queries by `staff_id`/`student_id`

## Migrations Created But Not Applied

Created:
- `20260625042338_performance_realtime_publication_proposal.sql`

This migration removes `public.activity_events` from `supabase_realtime` if it is present. It was not run. No production Supabase DDL was executed.

Removed:
- `20260625042342_performance_targeted_db_proposals.sql`

## Validation

Latest validation after removing activity Realtime and revising the migration:
- `pnpm --filter admin-web lint` passed with 4 unrelated warnings.
- `pnpm --filter admin-web typecheck` is blocked by unrelated issue feature errors: missing `extractMentions`, missing `IssueContentPanel`, and tag API type mismatches in `src/features/issues/**`.

Earlier validation from the first optimization pass:

Passed:
- `pnpm --filter marketing-web typecheck`
- `pnpm --filter student-web typecheck`
- `pnpm --filter tutor-web typecheck`
- `pnpm --filter admin-web typecheck`
- `pnpm --filter ucat-web typecheck`
- `pnpm --filter marketing-web lint`
- `pnpm --filter student-web lint`
- `pnpm --filter tutor-web lint`
- `pnpm --filter admin-web lint` (4 unrelated warnings)
- `pnpm --filter ucat-web lint`
- `pnpm --filter marketing-web build`
- `pnpm --filter student-web build`
- `pnpm --filter tutor-web build`
- `pnpm --filter ucat-web build`

Blocked:
- `pnpm --filter admin-web build` fails while collecting page data for `/admin-shifts` with `PageNotFoundError: Cannot find module for page: /(admin)/admin-shifts/page`. That page was already modified before this work and is outside the touched performance files.

## Risks And Regression Areas

Middleware:
- Protected route redirects should be manually smoke-tested in student, tutor, admin, and UCAT apps.
- Student public paths no longer refresh Supabase cookies in middleware. This matches the stated goal of avoiding public-path work, but login/reset/invite flows should be smoke-tested.

Realtime:
- Removing `activity_events` from the publication should be done only after staging validation. Issues, projects, tasks, notes, and messaging tables are intentionally kept live.

Notifications:
- Bulk mark-read endpoints should be smoke-tested for mixed valid/invalid IDs to confirm unauthorized IDs are rejected.

## Manual Checks

1. Deploy preview and compare middleware invocation rate by project.
2. In staging, check Supabase Realtime `list_changes` volume before any publication changes.
3. Open admin messages, switch contacts repeatedly, and verify channel count does not grow.
4. Open admin issues, projects, tasks, and notes in two browsers and verify cross-user changes appear without full page reload.
5. Confirm activity tabs still load on open/focus but no longer open `activity_events` channels.
6. Dismiss multiple student/tutor notifications and verify one network request updates the unread count.
7. Resolve the unrelated admin `/admin-shifts` build failure before relying on full admin build validation.
