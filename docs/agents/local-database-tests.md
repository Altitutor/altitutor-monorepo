# Local database validation with parallel agents

Coding and targeted tests can run concurrently in separate clones. Validation
preflight measures current host/container memory headroom before expensive gates;
this is a snapshot, not a reservation against another process starting later.
Database operations use ordinary Docker/Supabase and per-runtime kernel locks in
`scripts/owned_database.py` (Python 3.9+ standard library). No coordinator, daemon or
Docker/network customization is required.

## Ordinary entrypoints

```sh
pnpm checkall
pnpm db:seed:ucat
pnpm db:types
pnpm db:committypes
```

`pnpm check` runs the explicit `check` profile (preflight, lint, typecheck, unit
tests). `pnpm checkall` defaults to the `full` profile; `--profile check` is the
same narrow check and never certifies a full gate. `--database-only` records a
separate `database` profile. Each entrypoint emits a private temporary JSON
receipt with passed, failed, and not-run stages, assignment revision, source
head/base and dirty-worktree flag. See
[validation-delivery.md](validation-delivery.md) for evidence and delivery rules.

Use `pnpm check:preflight` or `pnpm checkall:preflight` to diagnose prerequisites
without starting containers or running tests. Preflight checks `.nvmrc` and
`packageManager`, isolated dependency paths, Python, and free memory (2 GiB for
check; 4 GiB for full/database, bounded by Linux cgroups). Full additionally uses
the real frozen Deno 2 loader with `--no-run --no-check`, trying the cache before
configured registries, with a 60-second bound per attempt. This can populate the
Deno cache, but does not change the lockfile. Full/database check the checkout's
Supabase CLI and Docker daemon. An unavailable image registry can use cached
images; their completeness is explicitly unverified until the owned startup.
Preflight output is prerequisite evidence, never test coverage or startup proof.

An install must belong to this checkout; share the package download store rather
than `node_modules` or its `.bin` directory. If preflight fails, correct the named
prerequisite before retrying expensive stages. It does not install tools, change
network policy, reset a database, or terminate another owner's processes.

Each local invocation prepares a fresh temporary Supabase runtime from this
checkout, with a unique `altitutor-agent-test-*` project ID and dynamically allocated
host ports, including the Edge inspector. Independent disposable test stacks run
concurrently. The helper takes that runtime's lock and individual port leases,
starts Supabase, verifies exact project labels, DB/API ports
and container IDs, binds consumers to the local test API, and stops only that
project with `--no-backup` before releasing its leases. Normal Docker host bindings
are accepted, as Matthew approved. The API clients still use localhost.

Owned startup and guarded reset install the resource bucket's four intended
Storage policies after the CLI has finished initializing Storage ownership.
`supabase/local/resource-storage-policies.sql` repeats the predicates from
`20260625090416_align_student_resource_access.sql`; failures stop setup rather
than silently leaving an unusable stack. The ephemeral hosted-CI seed path also
installs them. No roles/ownership are changed and this file is never a hosted
migration. Tutor and Student resource PDF tests use real Storage signing; the
Storage integration test checks entitled reads, other-subject denials and anon
denial through the API. Other buckets' local parity is outside this scope.

Never reset, seed or stop the normal `altitutor-admin-app` stack, another
checkout's stack or a remote database. Startup refuses an existing disposable
project rather than adopting a leftover stack. No credentials or `.env` files
are copied from the source tree. Local keys from the disposable stack stay in
child-process memory; startup's key-bearing output is suppressed. The installed
repo CLI is preferred; the ordinary PATH CLI is the fallback.

`checkall` runs preflight, contracts, lint, typechecking, unit tests, coverage and Edge checks
before taking its runtime lock. App builds and Expo exports then receive the
verified local settings inside the owned lifetime; unit preview tests remain
unconfigured. Startup, builds, reset, seed, database contracts, browser server/tests
and cleanup share one lock. The post-build reset remains: build-time data purity
has not been established. Typechecking budgets two workspace tasks. Full validation
runs the UCAT unit inventory once, through coverage; real Jest discovery must
prove the unit and coverage scripts select identical nonempty inventories before
the coverage run. Ordinary `pnpm test` still includes UCAT. The normal unit-test command budgets two workspace
tasks with at most two Jest workers each, also used by CI, so nested Jest worker pools
cannot multiply across the whole monorepo. `db:committypes` similarly holds it through reset/lint/type generation/build
and its existing generated-file-only commit. Independent runtimes do not wait on
that lock. Standalone seed/types also start
and end their own disposable stack. Type-generation failures preserve the prior
generated file. Hosted Linux CI retains its existing ephemeral runner stack for
seed/types, with exact project/container checks; that exception is unavailable
locally. `start-local-supabase.mjs` remains a hosted-CI startup helper.

For a targeted DB-dependent operation, put the entire operation under `run`:

```sh
python3 scripts/owned_database.py run -- bash -c '
  supabase db reset --local &&
  python3 scripts/owned_database.py verify-inner &&
  bash supabase/scripts/apply-ucat-test-seed.sh &&
  supabase test db --local
'
```

The supplied Supabase wrapper always selects the disposable workdir. Its guarded
`db reset --local` records verified new service IDs after a successful reset,
because Supabase can recreate API containers; unexpected replacements still fail
closed. Do not bypass the wrapper for a reset. Inside `run`, invoke the Python/shell helpers directly: package-manager
subprocesses can close inherited descriptors. Nested seed/type commands verify the inherited lock and container identities; do not
run a second outer gate from inside `run`.

## Explicit runtime and recovery

An optional manifest supports an explicitly targeted foreground runtime:

```sh
bash supabase/scripts/render-email-templates.sh
python3 scripts/owned_database.py prepare --workdir /absolute/disposable/runtime
export ALTITUTOR_TEST_DB_MANIFEST=/absolute/disposable/runtime/ownership.json
```

Preparation copies current Supabase source, changes identity/ports and records
source/config hashes; it does not start containers. The manifest belongs to this
exact checkout and source. Prepare a fresh runtime after source changes.
Successful automatic runs delete the temporary runtime; failed runs retain and
report the ownership manifest for inspection. Explicit runtimes remain on disk.

Each runtime's `lifecycle.lock` serializes consumers of that exact stack. Port
leases under the system temporary directory prevent this tooling from assigning
one host port to two runtimes. These locks never serialize independent stacks.
An occupied listener fails safely; retry an automatic invocation to allocate a
fresh port set. A leftover lock file is normal: never unlink it to break a living
consumer's lock. Consumers and
their process group end before stack cleanup and lock release. Failure, SIGINT
and SIGTERM during startup/consumption attempt scoped cleanup. SIGKILL or machine
shutdown can leave a disposable stack; inspect its manifest/config/container
state before recovery. Never blindly stop a foreign stack. No stale-stack daemon
or automatic deletion of an existing project is installed.

## Review evidence and optional local development

A custom Tailscale preview, shared port slot or timed hosting window is no longer
a scheduled-work completion gate. Retain functional tests, inspected candidate
evidence
where relevant, honest fixture/device limits and meaningful human review. Missing
or expired remote hosting alone is not a product question or reason to park work.

No review server is started by this policy. For a future local manual review,
the repository's existing isolated development command can be proposed with
independent app/database ports, loopback access and an explicit owner/stop
procedure. A terminal-backed server can remain available until that owner stops
it, but closing the terminal or machine shutdown may end it. This is a proposal,
not permission to start a server, keep disposable test resources indefinitely,
add persistent services or change routes/access. Preserve manual sessions and
owned test cleanup; never borrow another consumer's database or credentials.
