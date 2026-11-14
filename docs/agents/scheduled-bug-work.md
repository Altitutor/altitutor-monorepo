# Scheduled bug work

Work through Altitutor's Linear bug backlog, one issue per run in a fresh chat. Run daily at 8 a.m. Australia/Adelaide. Deliver a verified develop fix, a useful diagnostic change, or a precise evidence handoff. Keep durable state in Linear.

Read current AGENTS.md and docs/agents/issue-tracker.md. Verify the connected Altitutor workspace and Dev team before writes. Use Linear's connector; read every write back. The existing 7 a.m. Production error intake owns source-wide scanning and evidence-hold re-entry. Consume its evidence instead of repeating its full scans.

1. Select one actionable issue.

Fully paginate nonarchived DEV issues carrying the exact Bug label. Preserve Icebox, completed/canceled/duplicate work, human assignments, manual claims, explicit holds, blockers and delivery-stage ownership. Read the selected issue's full description, all comments, relations and attachments; latest verified evidence takes precedence over historical summaries. A ready-for-agent label alone proves neither eligibility nor a reproduction.

Resume this job's own unfinished work when a concrete next step is runnable. Waiting for CI, human input, deployment or recurrence is not runnable work. Read pending checks once; act on failures rather than repeatedly waiting. Resume a recorded checkout and lease instead of allocating a replacement.

For fresh pickup, select unassigned Backlog/Todo bugs without an active claim or unresolved dependency. Exclude tickets claimed by another chat or active dispatcher. Unclear dispatch ownership blocks pickup. Preserve another worker's issue and report useful candidates for an explicit handoff.

A needs-info label requires reading the actual question and answer. If the ticket already has an evidence hold, retry diagnosis only after an explicit human resumption or verified material change meeting its recorded resume condition. Mere age, updatedAt, a new generic comment, old-release repeats or event volume alone are not new evidence. Triage evidence holds re-enter only through the existing intake rules. Preserve assigned holds for their owner.

Order runnable candidates by native priority (Urgent, High, Medium, Low, unset), then evidence readiness (original symptom already red; precise steps/input and reachable path; incomplete incident evidence), then least recently investigated, creation time and ID. Record the evidence supporting readiness; a descriptive title is not proof of an easy fix. Every fifth newly selected investigation, choose the oldest eligible never-attempted or least-recently-attempted issue instead, unless an Urgent issue is runnable. Derive the selection count and last attempt from this job's Linear workpads, not updatedAt or local memory. An empty queue is a successful no-op.

Immediately before claiming, reread ownership and holds. Record this job/chat, UTC claim time, scope, acceptance, selection reason, last evidence baseline and next action in Linear. Verify the claim and reread before editing; conflicting claims stop this job's work on that issue. Connector claims are cooperative, not an atomic lock.

Ready: one issue has verified eligibility, a nonconflicting claim and a checkable next step, or the run records why none qualifies.

2. Invoke $work-on-ticket with that selected ID.

Read .agents/skills/work-on-ticket/SKILL.md and its reached references. This scheduled prompt explicitly authorizes routing the issue selected above into that workflow; it replaces only the manual-ID selection restriction for this job. Its broader manual merge authorization does not apply: retain the scheduled merge limits in step 4. Respect other chats' ownership.

Follow its isolation, resource ownership and preview procedures. For bugs, explicitly read and use $diagnosing-bugs at .agents/skills/diagnosing-bugs/SKILL.md. Read relevant CONTEXT.md and ADRs. Reproduce the original incident through its actual code path and exact symptom. Record the executed red-capable command, red output and minimization. An assumed-solution test or adjacent failure is insufficient.

Timebox an initial unreproduced investigation to 60 minutes of active diagnosis, excluding environment setup and required delivery checks. At that checkpoint, persist attempts/results and choose step 3 if the original symptom still cannot be reproduced. The budget is an explicit limit for this scheduled run, not evidence that a cause is known. When the original symptom is red, continue the skill's remaining phases and normal delivery.

Ready: original-symptom reproduction evidence exists, or a specific evidence gap and the actual attempted methods/results are recorded.

3. If reproduction is unavailable, improve the next investigation.

Use the diagnostic-evidence branch below; insufficient reproduction permits evidence gathering only. Separate established observations from unknowns. Identify the smallest evidence item that would distinguish the remaining explanations, where it can be captured, who owns the action and how it will produce an incident-shaped fixture or replay.

First use existing retained logs, traces, source maps, fixtures and prior diagnostics. Prepare minimal targeted redacted instrumentation only when it answers a stated question and existing capture is insufficient. Record discriminating predictions, trigger, allowlisted fields, correlation/release requirements, synthetic capture/redaction/sink-failure tests and removal criteria. Prove local capture; verify production deployment separately before expecting production evidence. If an instrumented recurrence lacks the expected capture, assess deployment, trigger, sampling/gating, delivery and retention before repeating diagnosis or adding probes.

Diagnostic-only work follows normal implementation, review, checks and the applicable merge approval. Keep diagnostic delivery separate from bug resolution, using a separate diagnostic issue and standalone Related to DEV-n lines for the original bug. Exclude the original ID from the diagnostic branch, PR title and squash subject; avoid closing/reference directives for it. Verify native linkage and generated release output leave the original unresolved. Use a subissue only after checking parent-completion behavior. A local diagnostic test going red/green does not reproduce the original incident. Production activation, deployment, remote DB writes and external side effects retain their existing authority limits.

When a specific human answer/access decision is required, set Awaiting Input with one actionable question, named next owner, evidence and usable review/access context. Use needs-info for an actual information request, preserving unrelated labels. When waiting on evidence or recurrence, park the original in Triage/needs-evidence with an explicit agent-parked record: attempts, incident baseline, exact missing fact, diagnostic PR/head, verified release status, expected next evidence, owner and re-entry condition. Distinguish pending deployment from deployed/awaiting recurrence. Release the active diagnosis claim while preserving resource ownership and retained work.

If no safe useful probe or evidence source exists, state the exact blocker and owner decision needed. An honest blocked outcome is valid; neither recurrence nor eventual resolution is guaranteed.

Ready: the next evidence has a concrete acquisition/capture path and resume condition, or its exact blocker is recorded; status, ownership and labels are verified.

4. Deliver reproduced fixes through work-on-ticket.

Follow its routed implementation, focused tests, human previews, final review, validation-plan gates, develop delivery and owned cleanup. Use [validation-delivery.md](validation-delivery.md) for authoritative integration CI, full local profiles, evidence reuse and queue admission. Keep the diagnostic skill as the reproduction authority and work-on-ticket as the delivery authority rather than copying their steps. Supply original incident evidence, actual reproduction and unresolved assumptions to the existing Spec reviewer. Use the required Standards/Spec review once, and review substantive changes afterward as required. Follow the Sentry-specific pre-commit/PR gate when applicable.

Apply this scheduled develop merge policy. Unattended merge is limited to narrow, unambiguous restorations of specified behavior with original-symptom red/green evidence, completed acceptance/review/checks and no unresolved human decision. Billing/payments, auth/security/RLS/permissions, migrations/destructive or critical data changes, functionality/product changes, owner-verifiable UX and unclear risk require explicit current-head owner approval. Prepare the concrete PR/base/head, evidence and usable preview before asking. Never infer approval from green tests, Todo or an answered product question.

Immediately before a permitted merge, verify current PR/base/head, effective protections, required CI/approvals, feedback and mergeability. Merge only into develop, head-bound through normal protected permissions. Read back merge SHA and In QA. Record develop inclusion, main inclusion, deployment and production effectiveness separately. Preserve incomplete work and complete owned cleanup or record its exact retention/blocker.

Ready: the reproduced fix is verifiably in develop with evidence and cleanup recorded, or the retained candidate has an exact remaining delivery step and owner.

5. Review neglected blockers and report.

On Mondays, spend up to 15 minutes reviewing at most five longest-waiting open bug blockers, using the existing Linear workpads and intake evidence. This is an audit, not automatic re-enrollment or a new review-date requirement. Distinguish: diagnostics pending deployment; deployed but no qualifying recurrence; expected capture missing; unanswered human request; and no useful evidence path. Propose one concrete next action/owner where needed. Preserve human ownership, holds and existing re-entry rules. Report status/description contradictions for reconciliation using authoritative PR/release evidence; do not infer merge or deployment from Linear state.

Maintain a compact workpad containing original symptom; disposition; priority/readiness evidence; last diagnosis and evidence baseline; attempted commands/results; missing fact; next action/owner; resume trigger; branch/lease/PR/head; deployment/capture status; retained resources. Update material changes only. A resumed attempt must cite what changed since its baseline.

Report newly verified develop fixes separately from diagnostic progress, blocked work and production-confirmed outcomes. Surface the best runnable next candidate and at most three concrete owner actions. Count diagnostic PRs as evidence progress, not fixed bugs. Measure throughput using verified develop fixes, time from actionable evidence to fix, and aged blockers by next owner. End unchanged non-actionable runs quietly.
