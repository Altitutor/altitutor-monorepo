# Marketing staff profiles

The about page reads `vmarketing_staff_profiles` on the server. Successful,
validated results and the rendered page are cached for 24 hours. A visit after
expiry triggers regeneration; this is not a scheduled daily job. Background
failures retain the previous successful version. A failed first build fails
rather than silently publishing the legacy roster.

Staff maintain plain-text biographies and profile images through their existing
portal. Active administrators maintain `staff_marketing_profiles` in the staff
modal or staff detail page's **Website** tab: publication, optional display name,
public title/subjects, and display order. Inactive staff never pass the public
view, even when the publication flag remains enabled. New staff default to hidden.
Bios and titles render as escaped text; profile image crop settings are respected.

**Refresh website** invalidates the cached data and `/about/`; the next visit
regenerates it. The admin server forwards the verified user's access token to the
marketing endpoint, which checks active administrator membership in Supabase.
There is no shared refresh secret or anonymous cache invalidation endpoint.

## Deployment

1. Ship `20260928120910_staff_marketing_publication.sql` through normal migration
   CI/CD before deploying the new website code. Do not apply it manually to prod.
2. Marketing requires `NEXT_PUBLIC_SUPABASE_URL` and
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a publishable key also works). These were
   configured in Vercel for production and preview on 2026-09-28; previews use
   the development database. No service-role credential belongs in marketing.
3. Admin's optional `MARKETING_APP_ORIGIN` overrides its refresh destination.
   Defaults: localhost:3003 in local development, development.altitutor.com in
   Vercel previews, altitutor.com in production.
4. Unconfigured local/CI builds use `src/features/staff/preview.json`, a read-only
   snapshot of public production profiles, photos and subject assignments. Refresh
   it with `node apps/marketing-web/scripts/staff-import/refresh-preview.mjs`. Vercel builds require config.

## Production backfill, 2026-09-28

The explicitly authorized import populated 11 empty biographies from the existing
website and uploaded 13 supplied photos plus four existing website photos. Emma
Choi's existing biography was preserved; her supplied photo replaced the profile
reference without deleting the previous file. Thomas Searston's existing trial
profile was untouched. Generic logo placeholders were not imported as portraits.

22 production staff matched. Confirmed aliases: Darshil Jang → Darshil Jangra,
RJ He → Rongjun He. Tim Naylor, Syme Aftab and Elliot Koh have no production record;
their editorial content and original images remain archived in the repository.
The migration initializes publication for the matched active editorial roster
plus active staff with supplied photos, including Emma Choi and Brian Ju.

- Original website assets remain in `apps/marketing-web/public/images/content/`.
- The source content is also captured in
  `apps/marketing-web/scripts/staff-import/website-profiles.json`.
- Local backup directory: `.local-backups/staff-profiles-2026-09-28/` (Git-ignored).
  It contains `production-before.json`, downloaded original database photos,
  copies of all current website portraits, and the import report. Keep this
  directory when cleaning the checkout. Original storage objects were not deleted.

The one-time `scripts/staff-import/import.mjs` script defaults to a dry run and
requires `--apply` to write. It reads the ignored production secrets file, asserts
the production project, fills only empty biographies, uploads content-addressed
new objects, and guards photo changes against concurrent edits. It is a backfill,
not a synchronization job: do not rerun it after staff begin updating profiles.
For a rollback, compare the original snapshot with current rows and restore only
this import's fields after checking for newer edits; never overwrite all staff
rows from the backup.

## Teaching badges

Cards read subject assignments from `staff_subjects`, not from the old free-text
website copy or current class bookings. The public view exposes only distinct
subject names and curricula. Years and IB levels collapse into one badge per
curriculum/name; SACE and IB stay separate. PRESACE renders as PreSACE, PRIMARY
as Primary; UCAT and Medicine Interview each have their own badge; Homework Help is omitted.
Changes use the same 24-hour cache and admin refresh action as the profiles.
`20260928123738_marketing_staff_subject_badges.sql` also removes the imported
`Tutor: …` lists from public titles, retaining administrative/course-manager text.

Administrative staff titles are derived from the current staff role by the public
view. Existing descriptive titles remain alongside “Administrative staff”.
