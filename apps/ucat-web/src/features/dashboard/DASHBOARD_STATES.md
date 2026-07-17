# UCAT dashboard state specification

The dashboard is a guided decision surface, not a collection of shortcuts. Its hierarchy is:

1. score trajectory canvas;
2. one contextual `Why` insight;
3. one prescribed `What now` action;
4. three supporting cards: `This week`, membership value, and `Recent attempts`.

`Explore` is intentionally absent because the sidebar already provides product navigation. There is no separate `Insights` card: the highest-value insight belongs in `Why`, next to the action it explains.

## Graph canvas invariants

- `Today` is fixed one-third of the way across the graph.
- The visible history window is the previous 60 days. Older trusted snapshots remain stored but are not shown on the dashboard.
- The visible future window is the next 120 days, matching the current bounded projection horizon.
- The historical line uses stored daily projection snapshots. It never reconstructs old displayed scores using today's model.
- The target is a horizontal reference line whenever a Study plan exists.
- The target label is interactive. Hovering or focusing it reveals cognitive section targets, current section estimates when available, and a link to edit the target or test date.
- `Today <score>` is annotated when a total estimate exists.
- An exact test date is annotated only when it falls inside the reliable projection horizon. The future axis is visually remapped so that date sits immediately before the floating insight card while the bounded projection continues beneath the card.
- A test year without an exact date is described as provisional in copy. It is not drawn as a fake testing window because the data model does not store a real window.
- Study plan mocks inside the visible window are annotated `M1`, `M2`, and so on. Hover or keyboard focus reveals the scheduled mock and date; the footer names only the next upcoming mock instead of listing every annotation.
- A maximum of six Study plan mocks is passed to the graph; only mocks inside the visible window render.

## Trajectory and `Why` states

The first matching state wins.

| Student state                                                                               | Graph                                                | Status            | `Why` title                                          | `Why` explanation                                                                                           |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ----------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Study plan request failed                                                                   | Blurred preview                                      | No score status   | We couldn't load your Study plan                     | The existing plan has not changed; retry before beginning unrelated work.                                   |
| No Study plan                                                                               | Blurred, decorative preview with no sample values    | No score status   | A goal needs a path                                  | Target, timing, and availability are required before the graph can be personal.                             |
| Study plan exists; projection request loading                                               | Graph skeleton                                       | Loading           | Derived after load                                   | `What now` remains available from the Study plan.                                                           |
| Study plan exists; projection request failed                                                | Unavailable graph state                              | Unavailable       | Your projection is temporarily unavailable           | The Study plan and recommended task still work while evidence reloads.                                      |
| Fewer than all three cognitive sections have a usable estimate                              | Dashed baseline scaffold                             | Building baseline | First, establish where you're starting               | Names the missing cognitive sections and explains that timed evidence unlocks the total trajectory.         |
| Total estimate exists but confidence is low                                                 | History plus projected range                         | Early estimate    | Your direction is forming—not fixed                  | More timed evidence is needed to narrow the range; no on-track judgement is made.                           |
| Medium/high confidence but no exact test date                                               | History plus 120-day bounded outlook                 | Set test date     | This is a 120-day outlook                            | Direction can be shown, but target timing cannot be judged without a real date.                             |
| Exact test date is beyond 120 days                                                          | History plus 120-day bounded outlook; no test marker | Long-range goal   | Your test is beyond the reliable forecast window     | The model stops at its reliable boundary instead of inventing an exam-day score.                            |
| Exact date inside 120 days and target is at or below the pessimistic test-day value         | History, range, target, test date, mocks             | On track          | Your current path supports the target                | Identifies the section with the largest target gap, then connects today's plan to maintaining the path.     |
| Exact date inside 120 days and target sits inside the plausible range                       | History, range, target, test date, mocks             | Within reach      | Your target sits inside the plausible range          | Identifies the largest section gap and explains that today's work is meant to improve and narrow the range. |
| Exact date inside 120 days and target is above the optimistic test-day value                | History, range, target, test date, mocks             | Needs adjustment  | Your current evidence suggests a gap                 | Identifies the section furthest from its target and directs the student to today's adaptive recommendation. |
| Needs adjustment and even the optimistic test-day value is at least 150 points below target | Same graph                                           | Needs adjustment  | This target is very unlikely on the current timeline | Quantifies the optimistic gap and links directly to changing the target or test date.                       |

The `Why` section is the dashboard's insight layer. It can say that the displayed total estimate has improved by a stored number of points, identify the largest section-to-section-target gap, or explain uncertainty. It only makes claims derived from stored snapshots, section estimates, Study plan targets, and projection confidence. A section may be described as “60 points below its section target”; it must not be described as “holding the total projection down by 60 points” because the model does not expose causal contribution.

## `What now` priority

Only one primary next action is shown. Priority is:

1. live tutor session;
2. tutor session starting within 90 minutes;
3. next incomplete Study plan task for today;
4. caught-up state when today's tasks are complete;
5. rest-day state when no task is scheduled today;
6. guided sampler when onboarding chose it but has not completed it;
7. Study plan setup;
8. retry when the Study plan request failed.

For a Study plan task, the panel shows task title, description, rationale, estimated time, and a context-sensitive `Start`, `Continue`, or `Review result` action. The Study plan remains a secondary link.

## Supporting cards

### This week

| State                                    | Display                                                                                                       |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| No Study plan and sampler journey active | First-step progress, sampler state, plan as the next milestone, and first result review as a later milestone. |
| No Study plan and no sampler journey     | A short prompt explaining that a Study plan creates the weekly path.                                          |
| Study plan with no tasks this week       | `Ready` and “No Study plan tasks this week.”                                                                  |
| Study plan in progress                   | Completed tasks / total tasks, completion bar, focused minutes, and next study day.                           |
| Past incomplete task exists              | `Plan adapting`.                                                                                              |
| All weekly tasks complete                | `Complete`.                                                                                                   |
| Tutor session today                      | Session time replaces the next-study-day row.                                                                 |

### Membership value

Membership does not affect score projection, confidence, target status, `Why`, or `What now`. It only changes this supporting card.

| Account state                                 | Display                                                                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Free plan; quota data loading                 | Skeleton.                                                                                                                                                                                     |
| Free plan; quota area available               | Most relevant quota, remaining usage, period, progress bar, reset availability, upgrade CTA, and quota-details link. The next Study plan task selects the preferred quota area when possible. |
| Free plan; at limit                           | Limit reached, reset/upgrade explanation, and upgrade flow.                                                                                                                                   |
| Free plan; quota data unavailable             | Unlimited value proposition and upgrade CTA without fabricated remaining usage.                                                                                                               |
| Paid plan; discount data loading              | Skeleton.                                                                                                                                                                                     |
| Paid plan; discount feature unavailable/error | Unlimited online study status and plan-details link.                                                                                                                                          |
| Paid plan; reward in progress                 | Questions remaining to earn today's discount, progress, whether today's recommended task contributes, and discount rules.                                                                     |
| Paid plan; reward earned today                | Today's secured discount and billing-period total.                                                                                                                                            |
| Paid plan; billing-period cap reached         | Maximum discount earned and amount coming off the next bill.                                                                                                                                  |

### Recent attempts

The card requests the four most recent completed attempts across practice, sets, and mocks.

| State   | Display                                                                               |
| ------- | ------------------------------------------------------------------------------------- |
| Loading | Three row skeletons.                                                                  |
| Error   | A non-blocking message directing the student to Progress.                             |
| Empty   | Explains that completed practice, sets, and mocks will appear here.                   |
| Results | Attempt type/name, score when available, completion date, and a direct `Review` link. |

## Independent dimensions

- Free vs paid changes only membership value.
- Study plan presence controls whether the graph can become personal and whether plan tasks/mocks exist.
- Projection evidence controls baseline, confidence, history, and score outlook.
- Exact test date controls exam-day status and test annotation.
- Test distance controls whether an exam-day projection is permitted.
- Sessions can temporarily override the Study plan task in `What now` without changing the graph.
- Capacity risk adds a separate warning beneath the three supporting cards; it does not change score status.
- Recent attempts do not currently change the selected `Why` insight directly. Their trusted projection snapshots and section estimates can change it on the next projection refresh.

## Development preview

In development, signed-in staff can visit `/dashboard/preview` and switch between:

- no Study plan;
- building baseline;
- early estimate;
- no exact date;
- distant test date;
- on track;
- within reach;
- needs adjustment;
- rest day;
- projection unavailable.

The route returns `notFound()` in production. Fixtures never write attempts, snapshots, profiles, or Study plans to Supabase.
