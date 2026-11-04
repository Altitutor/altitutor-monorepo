# Teaching iPad releases

Teaching is a native Swift/Xcode iPadOS 26+ app. Its release pipeline is separate
from Student/UCAT EAS builds. Keep the existing Teaching PR/develop tests and
unsigned Simulator validation. A main merge does not submit Teaching to Apple.

## Release owner and prerequisites

The owner is Matthew. Use existing Apple team `V2A5FZKMZ7`, bundle
`com.altitutor.teaching`, and App Store Connect app `6829958017`.

The `Teaching release` workflow is **manual only**. It must run its
trusted workflow code from `main` or `develop` and build an exact source SHA.
Production uses `https://tutor.altitutor.com`; QA uses
`https://tutor.development.altitutor.com`. Backend namespaces keep QA ink separate
from production ink. A QA build is not a production release candidate.

Before enabling signing, create a dedicated `teaching-release` GitHub environment
with Matthew (`matthewchua423`) as the sole required reviewer and selected deployment
branches `main` and `develop`. Disable administrator bypass for its protection
rules. A workflow reference alone can auto-create an unprotected environment:
preflight must verify protection instead of assuming the name is sufficient.
Never weaken an existing environment to make a run pass.

Environment secrets (never repository-wide secrets):

| Name | Material / purpose |
| --- | --- |
| `TEACHING_DISTRIBUTION_P12_BASE64` | Existing Apple Distribution certificate **and private key**, encrypted P12 |
| `TEACHING_DISTRIBUTION_P12_PASSWORD` | Password for that P12 |
| `TEACHING_PROFILE_BASE64` | App Store distribution provisioning profile for the existing bundle/team |
| `TEACHING_ASC_PRIVATE_KEY` | Dedicated App Store Connect P8 API private key |
| `TEACHING_ASC_KEY_ID` | That API key's identifier |
| `TEACHING_ASC_ISSUER_ID` | Its team issuer UUID |

Supplying signing keys to GitHub is a new credential destination. The earlier
approval to export a key into a temporary **local** keychain does not authorize
copying it into CI. Obtain the owner's explicit approval at that step, naming the
protected environment and scope. Do not put keys in chat, Git, PR bodies,
artifacts, command output or build summaries. Use a dedicated minimum-role API key
with access to Teaching where Apple's key type supports app restrictions. Manual
provisioning avoids CI creating/revoking certificates or profiles. The owner must
accept Apple agreements personally and keep the profile/certificate current.

The pinned Xcode 26 toolchain discovers provisioning profiles in
`~/Library/Developer/Xcode/UserData/Provisioning Profiles`, the location used by
Xcode 16 and later. Installation and owned-profile cleanup share that directory;
the older `~/Library/MobileDevice/Provisioning Profiles` is not the CI install
target. See [Apple's provisioning action](https://github.com/Apple-Actions/download-provisioning-profiles#install-location).

Rotate by replacing protected secrets, validating an archive without upload,
then performing an explicitly authorized upload. Revoke the old API key only
after its consumers are identified and the replacement works. Do not revoke a
shared Apple Distribution certificate solely to rotate this workflow's copy.
Remove access by deleting this environment's secret copies and revoking only a
dedicated API key, preserving other apps' signing dependencies.

## Dispatch and source/backend guards

1. Verify the exact intended commit is on the selected release branch and its
   current-head checks pass. Production requires the latest `main` and successful
   matching production deployment; develop inclusion alone is insufficient.
2. Select `Teaching release` in Actions on `main` or `develop`. Enter the complete
   source SHA, choose QA/production, and leave upload disabled for an archive-only
   rehearsal. Review the exact workflow SHA, source SHA, backend and version.
3. Preflight must verify the selected source, protected environment and deployed
   Tutor API identity. A healthy login page alone cannot prove the backend matches
   the app. Readiness also checks Supabase Auth with the configured anonymous key
   and performs a bounded zero-row read of a scoped view with the system service
   client. No lesson/account data is returned. Missing identity, unavailable
   dependencies or failed/mismatched deployment must fail closed.
4. Matthew reviews the protected job. The runner selects Xcode 26.5 (17F42) on
   macOS 26 and fails if that pinned toolchain is unavailable. Signing uses a
   temporary runner keychain and profile, with cleanup on success/failure.
5. Build identities use the workflow run number plus run attempt. Retries get a
   new build number; a build older than Apple's latest is rejected. Jobs share a
   global, non-canceling release concurrency group. There is no automatic retry
   after an ambiguous upload result.
6. Inspect the source/backend/version/IPA-hash receipt and archive artifact. To
   upload, dispatch with upload enabled after confirming source/backend remain
   current. An archive-only run does not establish an uploaded build.

## Outcomes and recovery

Record these separately: signed archive/export; upload accepted; Apple processing;
valid TestFlight build; pilot group availability; invitation acceptance/device
installation; App Review; unlisted approval; actual App Store release. The
workflow must never submit App Review or publish an App Store version.

If upload times out or disconnects, inspect App Store Connect for that exact
version/build before retrying. An accepted upload may still be processing. Do not
silently resend the same identity. A new workflow attempt gets a new build number;
if a later build already exists, dispatch a new run. Invalid binaries need the
reported cause fixed and a new run. Processing timeout is not proof of failure
or tester availability. Expired signing material requires owner rotation rather
than an authentication bypass. Keep sanitized receipts; never publish raw
credential/export logs.

An environment-protection or branch-policy failure is a concrete owner action.
Do not enable admin bypass, force-push, or use another token to evade it. A missing
Xcode version requires a reviewed toolchain update, followed by native validation.

## Office iPads and unlisted submission

Use the existing Altitutor iPad Pilot TestFlight group. Both office pilot accounts
were invited during DEV-291; check current membership/build availability before
claiming delivery. TestFlight expires after 90 days. Install updates through
TestFlight/App Store **without uninstalling**: editable ink remains local to each
iPad and reinstalling loses it. Tutor sign-in is separate from the tester's Apple
Account. Validate Pencil/palm rejection, displays, representative PDFs, offline
recovery and lock/background behavior on the oldest supported Pro and a current
Air before classroom use.

For permanent unlisted distribution, select the reviewed production build, verify
privacy/review demo/contact/export-compliance information, explicitly submit App
Review, then send Apple's unlisted request. Preserve manual release until Apple
approves unlisted distribution. The link is discoverability control; staff
sign-in remains the access control. Automation does not waive DEV-291/DEV-219
production and owner-acceptance gates.

## References

- [Apple upload and processing](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/)
- [App Store Connect API keys](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api/)
- [CFBundleVersion](https://developer.apple.com/documentation/BundleResources/Information-Property-List/CFBundleVersion)
- [GitHub protected environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- [Official macOS 26 runner toolchain inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md)

DEV-303 tracks implementation and first controlled run; this document alone does
not establish configured secrets, successful signing, upload or release.
