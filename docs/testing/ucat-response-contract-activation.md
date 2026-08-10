# UCAT response-contract activation and production verification

ALTI-544 completes the activation phase described in
`docs/plans/ucat-response-contract-migration.md`. It does not remove the legacy
`question_type`, `is_answer`, or `syllogism_v1` compatibility readers; ALTI-545
owns that contraction after the observation gate below is satisfied.

## Baseline captured on 2026-08-10

- A read-only request to the configured development project
  (`ysfslbdcacpbemodkwtl`) returned PostgreSQL error `42703` because
  `ucat_questions.response_type` is not deployed there yet.
- The read-only ALTI-540 production evidence records that production
  (`mzgunxjfgvcyivcyqimn`) also predates the response-contract expansion.
- Therefore neither hosted environment can truthfully provide post-activation
  zero counts before the migrations are deployed through CI/CD. No remote
  database was changed while capturing this baseline.

## Deployment order

1. Merge the complete response-contract application and migration series to
   `develop`. Let the Supabase deployment workflow apply migrations to the
   development project; do not run ad-hoc remote SQL writes.
2. Record the database migration completion time and deploy the matching tutor
   and student applications. The activation migration is rollback-compatible:
   canonical writes continue mirroring legacy columns and legacy-only writes
   remain accepted and observed.
3. As the database owner, run the read-only report below with the migration
   completion time. All six data checks must be zero before smoke testing.
4. Exercise authoring, import, publication, practice, set, mock, autosave,
   submission, and review for every Answer scheme. Repeat the report. All data
   checks and both legacy-write checks must be zero.
5. After development is clean, merge to `main` and repeat steps 2–4 in
   production. Do not infer production results from development because their
   historical IDs and content differ.
6. Keep compatibility enabled for **seven consecutive days after the latest
   production application deployment**. The window must include at least one
   real tutor content write and one student attempt write. Reset the seven-day
   clock after any application rollback or response-writing deployment.
7. Run the report with the start of that uninterrupted production window. Save
   its result with the deployment SHAs. ALTI-545 may begin only when every count
   is zero.

## Read-only report

Run in the Supabase SQL editor or through a read-only database session. Replace
the timestamp with the start of the uninterrupted observation window.

```sql
select check_name, issue_count, sample_ids
from public.ucat_response_contract_activation_report(
  '2026-08-10T00:00:00Z'::timestamptz
)
order by check_name;
```

Expected checks:

| Check | Required result |
| --- | ---: |
| `invalid_answer_keys` | 0 |
| `legacy_answer_key_writes_since_observation` | 0 |
| `legacy_answer_snapshots` | 0 |
| `legacy_question_writes_since_observation` | 0 |
| `missing_content_snapshot_contracts` | 0 |
| `missing_question_contracts` | 0 |
| `response_type_scheme_mismatches` | 0 |
| `unresolved_published_classifications` | 0 |

The answer-key observation trigger detects all legacy updates and legacy
inserts with a positive or placement key. A nullable single-choice distractor
has the same PostgreSQL row image whether a client explicitly supplies a null
canonical key or omits it. Consequently, the public tutor writer's payload
validation and the end-to-end authoring smoke test are required alongside the
database observation count.

## Rollback and hold rules

- If the migration fails a deterministic backfill assertion, CI must stop. Fix
  the migration against a restored local copy; do not bypass the assertion or
  patch the remote rows manually.
- If an application regression appears, roll back the affected application and
  leave the additive database migration in place. The legacy mirrors and
  compatibility triggers keep the previous application deploy usable.
- Do not reverse converted historical snapshots. `ucat_response_v1` is already
  understood by the expansion-era readers; restoring `syllogism_v1` would lose
  the verified forward state.
- Any non-zero data check blocks publication investigation and contraction. Any
  non-zero legacy-write check identifies an active compatibility caller; use
  the sampled stable IDs and application logs to find it, deploy a canonical
  fix, and restart the seven-day window.
- Keep the observation table and compatibility functions until ALTI-545 has
  removed the legacy representation. They are intentionally inaccessible to
  application roles and contain IDs and actor IDs only, never answer content.

## Evidence record

For each hosted environment, retain:

- project reference and environment name;
- database migration SHA and application deployment SHAs;
- migration completion and observation-window timestamps;
- the report rows before smoke testing, after smoke testing, and after seven
  days;
- the smoke-test operator and scenarios exercised;
- any rollback, non-zero count, remediation, and restarted window.
