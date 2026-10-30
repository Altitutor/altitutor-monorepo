# Altitutor Teaching for iPad

Native SwiftUI / PDFKit / PencilKit app for iPadOS 26+. Open
`AltitutorTeaching.xcodeproj` in Xcode 26. The app uses the authenticated
`/api/teaching` endpoints in TutorWeb; it contains no Supabase service credentials.
Production builds default to `https://tutor.altitutor.com`. `TEACHING_API_URL` is
an Xcode build setting; Debug also accepts the process environment override.

## Workspace

Lesson board is the first top tab; added lesson resources open in neighboring
tabs with the PDF using the full workspace width. Show/Hide solutions floats
over the document. Drag the wider divider to resize the two panes; ink and
viewports remain independent. Native PDF scrolling and pinch zoom replace the
former page/fit/rotate toolbar. Share worksheets or solutions separately from
a lesson card's context menu.

The detached Resources control opens a right-side drawer. Tap outside it to
dismiss it. Expand subject topic folders and tap a file to preview it inside
the drawer; only **Add to lesson** adds it to tabs and log suggestions. Preview
downloads are held in memory and never enter the local lesson store.

## Storage and classroom display

Session tokens use device-only Keychain storage. Passwords are never stored by
this app. Original downloads, ink, viewports, cached timetable and editable log
drafts live in Application Support with complete file protection, excluded from
backup, partitioned by backend, tutor and session. Sign-out removes the session
and clears the classroom display, while retaining that tutor's local lessons.
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
lesson information: subject/session kind, time, room and tutor. Use **Classroom
display** for an on-device preview. Screen mirroring by unrelated tools is
outside this external-scene presentation flow.

Previously downloaded PDFs and local drafts work after a connection drops.
Search, new downloads, adding Homework Help drop-ins and log submission require
a connection. Submission validates the current assigned roster and accessible
resources on the server and uses TutorWeb's existing submitter/permission rules.
Saved logs are read-only; corrections remain an administrator workflow.

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
  It writes temporary preview credentials to a mode-0600 file, never stdout.
  Stop the owned runtime to dispose of all fixture data. It rejects remote targets.

Real-device pilot checks remain necessary: Apple Pencil pressure/palm rejection,
AirPlay/cable behavior on the fleet's oldest Pro and current Airs, rotation and
page alignment on representative production PDFs, loss/recovery of Wi-Fi,
background/lock recovery, and share-sheet destinations.

For a richer fictional library on an existing owned preview, run
`pnpm dev:isolated exec -- node apps/teaching-ipad/Verification/expand-preview-library.mjs /path/to/owned-api-receipt.json`.
It verifies the runtime/receipt and synthetic tutor/file ownership before adding
nested folders, multiple worksheets and paired solutions. Node 22.13+ is needed
for this checkout's pinned pnpm 11; Node 22.22 is installed on the development Mac.

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

The repository intentionally has no development team, provisioning profile or
App Store Connect credential. A release owner must configure the new app record,
signing and distribution; this workflow neither uploads nor publishes an app.
Deploy the matching TutorWeb API before a production pilot. The simulator build
and CI do not establish device signing or authorize an App Store release.
