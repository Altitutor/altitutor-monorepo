# Altitutor Teaching for iPad

Native SwiftUI / PDFKit / PencilKit app for iPadOS 26+. Open
`AltitutorTeaching.xcodeproj` in Xcode 26. The app uses the authenticated
`/api/teaching` endpoints in TutorWeb; it contains no Supabase service credentials.
Production builds default to `https://tutor.altitutor.com`. `TEACHING_API_URL` is
an Xcode build setting; Debug also accepts the process environment override.

## Office sign-in

The first login on each office iPad uses an active staff account's email and
password once to set up its staff picker. Thereafter choose a name and enter that
person's password or their enrolled Teaching PIN. **Update staff list** opens the setup login again if a new
staff member is missing. Every successful login refreshes the active staff list;
deactivated accounts are rejected by server authentication even if an old picker
entry remains. The directory contains only names, IDs and login emails for active,
linked Tutor/AdminStaff accounts; deleted/unlinked staff are excluded.

The directory endpoint requires an authenticated active staff bearer session.
The app keeps the directory in backend-scoped, device-only, unlocked Keychain
storage across logout. The directory grants no lesson access by itself.

A tutor can set a four-digit Teaching PIN from the menu after confirming their
account password. Each iPad can remember several tutors in its device-only
Keychain, with one workspace active at a time. Log out to switch tutors. The PIN
is verified locally. Remembered credentials are sealed by the server and only
accepted by the Teaching API, which rechecks the tutor’s active staff access. Five incorrect attempts, 30 days, or revoked access require password
sign-in. Tutors set up the PIN independently on each iPad. TutorWeb continues
to require the account’s normal sign-in credentials.

## Workspace

The timetable pushes a lesson board with native back navigation. Tap a thumbnail
card to open the file
workspace, switch files with Liquid Glass tabs, and use the top-left back button
to return to the board. Cards have a uniform size and can be dragged into a new
order. Document tabs support the same live reordering and share that saved
order. Dragging uses a local move operation and updates neighboring positions
as the dragged card enters them. Long-press a card or tab for the same share,
fresh-copy and remove actions. VoiceOver also exposes ordering actions. Removing
a resource archives its pinned files and ink locally and excludes it from the
log draft; re-adding restores the original copy.

Show/Hide solutions stays fixed in the file-tab row while tabs scroll beneath
it and slides the solutions pane in and out. Tabs and library files show file
codes before filenames; selected glass tabs use semantic text contrast. Drag
the divider to resize the two panes; ink and viewports remain
independent. Native PDF scrolling and pinch zoom replace the former toolbar.

Use the temporary page indicator or swipe inward from the left edge to open page
thumbnails. Tap a thumbnail to jump; its ellipsis menu inserts a matching blank
page before/after or deletes that page (the last remaining page cannot be
deleted). A page indicator appears during scrolling/jumps and for two seconds
afterward; its sidebar button also toggles thumbnails. Worksheet and solutions
keep independent page sequences. Page edits atomically save the local PDF,
rebased ink and position together; the pinned original remains intact. Disk
retention keeps the current and immediately previous revision. Sharing and the
classroom display and office-print previews follow the edited worksheet.

The detached Resources control toggles a floating rounded drawer on the right.
Swipe inward from the right edge to open it; swipe it right or tap outside to
dismiss. Topic folders use a faster 180 ms disclosure animation. Expand folders and tap a
file for a separate preview sheet with Close and **Add to lesson** actions. Only
adding inserts a file into the lesson and log suggestions; preview downloads
stay in memory. A single native search field matches codes and filenames and presents
flat relevance-ranked results. Exact codes rank first, then exact names,
prefixes and substring/token matches. The app automatically fetches every API page
for the selected subject or search; there is no manual Load more step. PDF bytes
are downloaded only for preview or adding, not while browsing the catalog.
Pull to refresh reloads accessible subjects, current resources and suggestions. The
lesson subject is selected on entry when accessible. The header menu groups accessible subjects by ascending year level, with
alphabetically sorted short names in each submenu; subjects without a year
appear under Other. Suggested files
appear first: unused files from the active topic,
with the next file in the same type/sequence prioritized. An empty lesson uses
the latest earlier logged lesson assigned to this tutor with the same subject
and student group (within the 100 most recent earlier sessions). Panel motion
respects the system Reduce Motion preference.

## Storage and classroom display

Active sessions and optional remembered PIN grants use device-only Keychain
storage. The app stores no passwords. Original downloads, ink, viewports, cached timetable and editable log
drafts live in Application Support with complete file protection, excluded from
backup, partitioned by backend, tutor and session. Sign-out removes the active session and clears the classroom display. It retains
that tutor’s local lessons and any separately enrolled PIN grant.
Reinstalling the app or erasing the device loses these local-only annotations.

Adding a resource pins its worksheet and solutions bytes. Re-adding opens the
existing lesson copy. The lesson-board context menu offers **Download a fresh
copy**, which reloads current resource metadata and creates an independent
snapshot; it never moves existing ink onto replacement pages. Sharing exports a
flattened annotated PDF into a temporary protected folder, cleaned after the
share sheet closes or on the next launch. Worksheet and solutions exports are
separate actions.

Connect an external display through AirPlay or a cable. The external scene
receives only the active worksheet page, visible region, rotation and ink.
Solutions never enter its model. The lesson board and log review show safe
lesson information: subject/session kind, time, room and tutor. Resource previews
also keep this lesson information on the external scene. Screen mirroring by
unrelated tools is
outside this external-scene presentation flow.

Previously downloaded PDFs and local drafts work after a connection drops.
Search, new downloads, adding Homework Help drop-ins and log submission require
a connection. Submission validates the current assigned roster and accessible
resources on the server and uses TutorWeb's existing submitter/permission rules.
Saved logs are read-only; corrections remain an administrator workflow.

Use **Import PDF** on the lesson board, or drop PDFs onto it, to copy documents
into that tutor's local lesson. The next card's **+** menu creates a blank
portrait/landscape PDF or opens Resources. Local documents have no catalog/topic
identity. Importing alone never publishes them or adds taught topics.

The document toolbar groups Share and Review log, with Print to office beside
them. Sharing exports the annotated worksheet; solution sharing remains a
separate menu action. Board-card menus also offer Print. Every PDF uses the office
queue, including imported and blank documents. Preview the exact flattened PDF
before sending it; **Include annotations** and **Include blank pages** default off.
Blankness is judged from visible output, including scans and selected handwriting.
The queue keeps 1–20 copies, black-and-white A4 duplex and a top-left staple. Connector health, office access/window, duplicate protection
and caller-private status are enforced by the existing server contracts. The app
polls status for up to two minutes and warns before retrying an ambiguous job.

## Shared lesson PDFs and private storage

Log review has a separate, default-on sharing section for marked-up worksheets
and nonempty local PDFs. Selecting a worksheet annotation also selects its
canonical file; deselecting the canonical file deselects its annotation. Solutions
remain private. Confirm attendance and each PDF's student assignments before
submission. Verified snapshots publish atomically with the log; retries keep the
same immutable snapshot and submission identity.

Tutors use existing log access. Assigned students retain the submitted snapshot
for one year independently of general catalog entitlement. The session dialogs
in TutorWeb, StudentWeb and Student app pair annotations with catalog files where
available, with local/fallback links and expired stubs. Current log retirement and
canonical assignment corrections still control access. Download URLs are signed
only after role-scoped authorization and last at most 60 seconds.

The private `teaching-print` / `teaching-lessons` buckets are server-only. CI runs
`supabase/scripts/teaching-private-storage.sql` after migrations/Storage
initialization and fails deployment if it cannot install the restrictive policy.
The upload API refuses to issue URLs until that guard exists. The owned API
fixture mirrors this deployment step because fresh CLI stacks initialize Storage
after application migrations. Never apply this script manually to a remote DB.

TutorWeb's authenticated `/api/cron/teaching-documents` maintenance runs every ten
minutes using the existing `CRON_SECRET`. It claims rows before deleting bytes
through the Storage API, retries failures with backoff, and preserves metadata.
Unsubmitted uploads expire after 24 hours. Published lesson bytes expire after one
year. Print bytes expire 24 hours after all jobs reach a terminal result; queued
or claimed jobs never expire. Cleanup and enqueue lock the same snapshot row.
Pull to refresh on the lesson board syncs pinned PDF originals for the signed-in
tutor and shows available documents from the preceding session of the same
class. The server keeps immutable originals in private storage for up to one
year. Each iPad keeps its own editable ink, page revisions, order, and removals.
Protected snapshot caches are purgeable and contain no signed URLs or session
credentials.

## Verification

- `swift test --package-path apps/teaching-ipad` exercises the tutor/session
  lesson-store boundary without iOS frameworks.
- `xcodebuild -project apps/teaching-ipad/AltitutorTeaching.xcodeproj -scheme
  AltitutorTeaching -configuration Release -sdk iphonesimulator -destination
  'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` checks the
  native app. The dedicated GitHub workflow runs these checks on macOS.
- To interact with the simulator, use local ad-hoc signing
  (`CODE_SIGNING_ALLOWED=YES CODE_SIGN_IDENTITY=-`); unsigned builds cannot use
  the simulator Keychain.
- `Verification/make-preview-pdf.swift` creates fictional worksheet/solution PDFs.
  `Verification/owned-api.mjs`, run through `pnpm dev:isolated exec`, proves its
  target is the owned disposable local database before creating synthetic users,
  resources and lessons. It exercises native sign-in/refresh, access control,
  signed downloads, Swift UUID casing, drop-ins and log validation. It installs
  the repository's existing tutor storage SELECT contract locally because CLI
  storage starts after migrations and lacks dashboard-managed storage policies.
  `Verification/library-print-api.mjs` reuses a proven synthetic fixture to check
  code search/relevance, caller subject access and print policy/queue/status.
  Its fake connector exists only in the disposable stack; settings are restored
  and its synthetic job cancelled. It never talks to the real office printer.
  It writes temporary preview credentials to a mode-0600 file, never stdout.
  Stop the owned runtime to dispose of all fixture data. It rejects remote targets.
- After the owned fixture, run `Verification/documents-api.mjs`,
  `document-retention-api.mjs`, `document-access-api.mjs`, and
  `private-storage-api.mjs` through `pnpm dev:isolated exec`, passing the protected
  fixture receipt path. These exercise actual upload/completion, queue, atomic
  log/retry, role download, assignment correction, supported retirement and
  cleanup APIs with fictional PDFs only. `Verification/workspace-api.mjs` checks
same-tutor access from a second sign-in, the same-class previous lesson, exact
worksheet and solutions bytes, and denial for a co-assigned tutor. The private
storage tests also prove a permissive legacy
  Storage policy cannot grant direct reads/writes and missing guard configuration
  fails closed. No physical print connector is used.

Real-device pilot checks remain necessary: Apple Pencil pressure/palm rejection,
AirPlay/cable behavior on the fleet's oldest Pro and current Airs, rotation and
page alignment on representative production PDFs, loss/recovery of Wi-Fi,
background/lock recovery, and share-sheet destinations.

For a richer fictional library on an existing owned preview, run
`pnpm dev:isolated exec -- node apps/teaching-ipad/Verification/expand-preview-library.mjs /path/to/owned-api-receipt.json`.
It verifies the runtime/receipt and synthetic tutor/file ownership before adding
nested folders, multiple worksheets and paired solutions, plus five subjects
across Years 9, 10 and 12 for reviewing the nested menu. Use the Node version pinned in the repository's `.nvmrc`.

## Installation

Use TestFlight for the pilot, then request an unlisted App Store distribution
for persistent installation with ordinary App Store updates. Both use the
existing Apple Developer membership. TestFlight builds expire after 90 days;
unlisted distribution requires Apple's review and approval and is not a secret
or access-control boundary. Tutor authentication still controls lesson access.
There is no paid third-party distribution dependency. See Apple’s
[TestFlight](https://developer.apple.com/testflight/) and
[unlisted distribution](https://developer.apple.com/support/unlisted-app-distribution/)
guidance.

The regular native validation workflow does not sign or publish. The separate,
manual-only [Teaching release workflow](../../.github/workflows/teaching-release.yml)
can archive/export and, only when explicitly selected, upload for TestFlight
processing. It requires a protected owner-reviewed environment and exact matching
source/backend deployment. Signing credentials remain outside Git. See the
[release-owner runbook](../../docs/agents/teaching-releases.md) for prerequisites,
dispatch, retry/cleanup rules and the distinction between processing, tester
availability and an App Store release. No main merge silently submits Teaching
for App Review or releases an App Store version.

### Office iPad QA installation

1. Wait for the matching develop TutorWeb API deployment. For QA, set the app's
   `TEACHING_API_URL` build setting to `https://tutor.development.altitutor.com`;
   use synthetic/test accounts against that development backend. The default
   `https://tutor.altitutor.com` is production and requires the matching production
   API release first. A develop merge alone does not deploy either environment.
2. Open `apps/teaching-ipad/AltitutorTeaching.xcodeproj` in Xcode. Choose the
   AltitutorTeaching target, select your existing Apple Developer team in
   **Signing & Capabilities**, and leave automatic signing enabled. Register
   `com.altitutor.teaching` and create its iOS app record in App Store Connect
   if these do not already exist. Use the same bundle ID for TestFlight and the
   eventual unlisted release. Increment the build number for every upload.
3. Choose **Any iOS Device (arm64)** as the destination, then **Product → Archive**.
   In Organizer choose **Distribute App → App Store Connect → Upload**. Avoid
   an internal-only build if the same archive will be used for external testing
   or App Review. Complete the upload/compliance prompts.
4. In App Store Connect → Altitutor Teaching → **TestFlight**, select the processed
   build. Add an internal tester group if the iPads' Apple Accounts already have
   App Store Connect access. Otherwise create an external group, supply test
   instructions/review access, and submit it for TestFlight Beta App Review.
5. Install Apple's TestFlight app on each office iPad (iPadOS 26+), open its tester
   invitation/link on that iPad, and tap **Install**. The tester's Apple Account is
   separate from the tutor account used inside Altitutor Teaching. Enable
   automatic TestFlight updates. Do not uninstall the app to update it: ink is
   local-only. Verify Pencil, display casting, offline recovery and exports on
   both the oldest Pro and a current Air before classroom use.
6. Complete the one-time staff setup inside the app on each iPad. After logout,
   staff use the name picker and their own password. QA and production use
   separate backend namespaces; QA annotations will not appear in production.
7. After QA, archive with the production API URL and submit the final app to App
   Review with a note requesting unlisted distribution, then submit Apple's
   unlisted-distribution request. Wait for approval before distributing the App
   Store link. Install from that link on each office iPad and enable App Store
   updates. This removes TestFlight's 90-day build expiry and needs no third-party
   MDM subscription. Keep the Apple Developer membership current and ship updates
   through the same app record. Anyone with the link can download it; staff
   credentials still control access.

Apple references: [Xcode distribution](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases),
[TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/),
[external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/),
[unlisted distribution](https://developer.apple.com/support/unlisted-app-distribution/).
