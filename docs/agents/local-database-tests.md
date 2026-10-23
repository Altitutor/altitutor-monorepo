# Local database validation with parallel agents

Coding, lint, builds and unit tests can run concurrently in separate clones.
Database operations use ordinary Docker/Supabase and per-runtime kernel locks in
`scripts/owned_database.py` (Python 3.9+ standard library). No coordinator, daemon,
Symphony fork or Docker/network customization is required.

## Ordinary entrypoints

```sh
pnpm checkall
pnpm db:seed:ucat
pnpm db:types
pnpm db:committypes
```

Each local invocation prepares a fresh temporary Supabase runtime from this
checkout, with a unique `altitutor-agent-test-*` project ID and dynamically allocated
host ports, including the Edge inspector. Independent disposable test stacks run
concurrently. The helper takes that runtime's lock and individual port leases,
starts Supabase, verifies exact project labels, DB/API ports
and container IDs, binds consumers to the local test API, and stops only that
project with `--no-backup` before releasing its leases. Normal Docker host bindings
are accepted, as Matthew approved. The API clients still use localhost.

Never reset, seed or stop the normal `altitutor-admin-app` stack, another
checkout's stack or a remote database. Startup refuses an existing disposable
project rather than adopting a leftover stack. No credentials or `.env` files
are copied from the source tree. Local keys from the disposable stack stay in
child-process memory; startup's key-bearing output is suppressed. The installed
repo CLI is preferred; the ordinary PATH CLI is the fallback.

`checkall` runs coding/lint/build/unit stages before taking its runtime lock. Startup,
reset, seed, database contracts, browser server/tests and cleanup then share one
lock. `db:committypes` similarly holds it through reset/lint/type generation/build
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

## Prototypes

Use the normal Next.js server through the foreground port lock:

```sh
python3 scripts/owned_database.py preview --app ucat-web
```

The existing loopback 57340/private Serve route permits one preview. An occupied
port or another preview blocks startup. Without a manifest, inert database values
support the prototype skill's in-memory data and stub mutations; this takes no
DB lock. An explicitly approved DB-backed preview can supply the optional
manifest: its stack startup/server/cleanup then hold that runtime's DB lock for
the foreground lifetime. Independent DB tests continue. Do not leave background
servers beyond the consumer lifetime. This does not change Tailscale routes or
claim remote/device verification.


For final human review, keep screenshots/interactive evidence distinct from
exploratory prototypes. In-memory review fixtures take only the existing preview
port lease and do not block database testing. DB-backed guarded previews are
bounded foreground validation windows: stop them before waiting for human review;
never borrow a disposable runtime that
another consumer will clean up. If the implemented functionality needs stable
test data and a pause-safe interactive host, record that limitation and request
the smallest explicit setup decision instead of adding a stack/service fleet.
See WORKFLOW.md and docs/agents/symphony.md for final handoff requirements.

For concurrent app development with local fixtures and automatic app/backend
connection settings, use the foreground command in [Worktree development](worktree-development.md).
