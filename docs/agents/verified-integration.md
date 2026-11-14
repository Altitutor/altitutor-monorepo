# Reusing integration verification

Development deployment first looks for a successful same-repository `merge_group`
run of `.github/workflows/ci.yml` whose integration tree exactly equals the pushed
commit tree. The source SHA may differ after a squash merge. A successful final
CI receipt binds the actual checkout, selection base/head, actual pinned Node, pnpm, Deno and setup Supabase versions,
and complete input tree (including workflows, lockfiles, toolchain declarations,
telemetry/environment policy and tests). The selection base must be an ancestor
of the deployment commit's parent, so the verified range covers the new delta.

Only a receipt downloaded from that successful run's GitHub artifact endpoint is
accepted. Local receipts, PR branch statuses and matching names alone are not
proof. No application build artifact is reused. The receipt producer is gated by
all required CI results and the browser/database aggregate; never upload it from
a failed or incomplete validation.

A missing, expired, malformed or mismatching receipt, unavailable API, unknown
base object, or a toolchain difference falls back to the existing CI verification.
Main and manual deployment always verify again. The first release of this policy
also falls back because older CI runs lack the receipt. Queue activation and a
successful merge-group run are necessary before development can benefit.

This policy does not remove deployment environments, migration guards or the
non-cancelable deployment concurrency group. It uses only `contents: read` and
`actions: read`; GitHub's existing deployment credentials remain in their current
protected job. Validate actual reuse and forced-fallback paths in GitHub before
claiming time saved. A changed workflow or dependency configuration changes the
input tree and invalidates prior evidence.

The receipt records setup Supabase 2.107.0 separately from the repository CLI
resolved by the lockfile (used by owned database tests). Both declarations are
bound by the full tree; this does not claim all tests use one CLI version.
Deno is pinned to 2.9.6. Updating these runtime pins requires updating the helper
expected versions and workflow setup together. Required job outcomes are included
and checked individually. Artifact run/head metadata and the GitHub SHA256 archive
digest must match; missing digest support conservatively disables reuse.

This reuses only the CI workflow validation obligation; independent required
native/schema checks and branch protection remain required before merge. It does
not reuse production build output or infer production secret/environment parity.
The environment being reused is the same source-controlled CI test environment.
