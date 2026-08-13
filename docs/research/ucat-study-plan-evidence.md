# Evidence review: UCAT study-plan and score-prediction rewrite

Date: 2026-08-10

## Question

Is the proposed three-phase UCAT study plan in `Study plan and score prediction rewrite.md` a sound basis for Altitutor, and what changes are warranted by direct UCAT evidence and broader learning/assessment research?

## Bottom line

The proposed **learning → timing → exam** structure is directionally sound. It also matches the order recommended by UCAT ANZ: learn the test and question approaches, use question banks, and progress to timed practice tests nearer the test date. The live exam's separately timed subtests and inability to pause make full-section and full-test rehearsal at standard timing necessary for representative measurement. ([UCAT ANZ preparation guidance](https://www.ucat.edu.au/prepare/), [UCAT ANZ test format](https://www.ucat.edu.au/about-ucat-anz/test-format/))

The proposal is **not yet a defensible deterministic specification**. Its weakest points are:

1. one full set at 70–75% is too noisy to be a robust graduation gate;
2. module completion cannot validly compensate for missing performance evidence;
3. actual speed must not automatically become the next prescribed pace, because fast inaccurate work is not readiness;
4. fixed section/benchmark cycles ignore recency, coverage, uncertainty and opportunity for improvement;
5. the proposed mock cadence is a reasonable coaching policy, not something established by UCAT research;
6. a fixed penalty that converts slow accuracy into a predicted score is not psychometrically defensible; and
7. targeted and untimed work should guide planning, but only representative standard-time sets should directly anchor a student-facing exam-score projection.

The central architectural recommendation is to maintain **two related but distinct estimates**:

- a **learning state** for planning, which can use all attempts, response times, category evidence and review history; and
- an **exam-condition score projection**, anchored mainly by standard-time, representative full-section/mock evidence and accompanied by uncertainty.

This separation prevents the visible score from being distorted merely because the planner has deliberately increased time pressure.

## Strength of the evidence

This review uses three labels throughout:

- **Direct UCAT evidence**: current official UCAT/UCAT ANZ specifications, Pearson technical reporting published by UCAT, or an original study using UCAT candidates and scores.
- **Broader direct evidence**: an original peer-reviewed experiment or psychometric paper, but not a UCAT-specific one.
- **Design inference**: an Altitutor policy that follows reasonably from those sources but has not itself been validated for UCAT candidates.

No located UCAT source validates a 65%, 70% or 75% learning threshold; a 0.5× pace rung; a specific pace-advancement rule; a two-month exam-phase boundary; or a prescribed number of mocks per week. Those values must be treated as initial product policies to validate, not scientific constants.

## Direct UCAT constraints

The 2026 UCAT ANZ has three cognitive subtests plus Situational Judgement. The standard cognitive sections are VR 44 questions in 22 minutes, DM 35 in 37 minutes and QR 36 in 26 minutes. The test is just under two hours, cannot be paused once started, and each subtest is separately timed. ([UCAT ANZ test format](https://www.ucat.edu.au/about-ucat-anz/test-format/))

UCAT ANZ awards cognitive scores from 300–900 per section and sums VR, DM and QR to 900–2700. VR and QR questions are worth one mark. DM single-answer questions are worth one mark; multiple-statement questions are worth two marks with one mark for a partially correct response. There is no negative marking. SJT is reported separately. ([UCAT ANZ scoring](https://www.ucat.edu.au/about-ucat-anz/scoring/))

The official sequence supports the proposal's broad phases: UCAT ANZ recommends tutorials before question banks and timed practice tests. It says the official practice materials are representative of the live test and warns that third-party items may distort practice performance. The official practice tests themselves do **not** provide a scaled score. ([UCAT ANZ preparation guidance](https://www.ucat.edu.au/prepare/), [official practice tests and question banks](https://www.ucat.edu.au/prepare/practice-tests/))

An original national study linked 5,439 UK candidates' 2017 preparation survey responses to their UCAT scores. After adjustment, reported use of official timed practice tests had the largest resource association with total score (mean difference 67.77 points, 95% CI 52.01–83.53), and greater preparation time was associated with higher performance. This was observational, only 38% of invited candidates responded, preparation was self-reported, and the 2017 test included the now-removed Abstract Reasoning section. It supports representative timed practice, but **does not establish causality, mock cadence, or readiness thresholds**. ([Kulkarni, Parry & Sitch, 2022, doi:10.1186/s12909-022-03811-y](https://doi.org/10.1186/s12909-022-03811-y))

Pearson's 2025 technical report is also a warning against false precision. The live cognitive bank uses item-response-theory difficulty parameters, item discrimination screening, pretesting, annual equating and item-drift checks. In the 2025 UK forms, section scaled-score standard errors of measurement were roughly 39 points for VR/DM and 45–50 for QR; the total-score SEM was roughly 69–72. The same report compares UK and ANZ item statistics on a shared anchored difficulty scale. A commercial prediction should not imply greater precision than the official test itself, much less greater precision than a short practice sample. ([2025 UCAT technical report, pp. 46–58](https://www.ucat.ac.uk/media/1726/ucat-2025-technical-report-final.pdf))

## Learning phase

### What is sound

Teaching a method, practising it, and reviewing the resulting answers is a good loop. Repeated retrieval after an item had first been learned produced much better delayed retention than repeated study in Karpicke and Roediger's original experiment, and feedback improved later retention by correcting errors and low-confidence correct responses in Butler, Karpicke and Roediger's experiments. These were vocabulary/general-knowledge tasks rather than UCAT reasoning tasks, so using them for UCAT planning is an inference, but they support **practice plus explanation/review**, not passive module completion alone. ([Karpicke & Roediger, 2008, doi:10.1126/science.1152408](https://doi.org/10.1126/science.1152408), [Butler, Karpicke & Roediger, 2008, doi:10.1037/0278-7393.34.4.918](https://doi.org/10.1037/0278-7393.34.4.918))

Targeted category practice is appropriate while a method is first being acquired. After the basic methods have been introduced, previously learned types should recur in mixed practice. In Rohrer and Taylor's experiments, spacing one problem type across sessions and interleaving already learned problem types improved performance on a delayed test compared with massed or blocked practice. This was mathematics learning, not UCAT, so the correct inference is a gradual **blocked-to-interleaved transition**, not random mixing from a student's first question. ([Rohrer & Taylor, 2007, doi:10.1007/s11251-007-9015-8](https://doi.org/10.1007/s11251-007-9015-8))

### What should change

**Do not make essential-module completion a universal graduation requirement.** A student can have learned the method elsewhere, and completion records exposure rather than mastery. More importantly, the proposed “experience route” allows completed modules to make up for an accuracy deficit. The cited retrieval and feedback experiments provide no basis for treating passive or completed instruction as equivalent to performance evidence. Modules should be interventions suggested when evidence indicates a method gap, not readiness currency.

**Do not graduate a section from one threshold-crossing set.** A result such as 75% on a single 44-question VR set has an approximate 95% Wilson interval of about 61–85%; a similarly sized DM or QR set is no more stable. This is ordinary binomial sampling uncertainty before allowing for item difficulty, clustered passages, guessing or day-to-day variation. Use smoothed evidence across sessions and retain a minimum full-section calibration requirement.

**Do not require “score estimate available” as a learning gate.** Readiness is a learning-state decision; score availability is a measurement-state decision. Making one depend on the other creates a circular rule and keeps students with sparse representative evidence in learning even when their method evidence is sufficient.

**Treat the proposed 75% at 0.5× and 70% benchmark criteria as configurable strong-evidence routes, not universal gates.** There is no direct evidence for those values. A robust initial rule should allow several routes out of learning while exposing its uncertainty:

- a performance route: adequate question-type coverage across multiple sessions plus stable smoothed accuracy;
- an experience route: materially greater practice coverage across multiple sessions, even if the accuracy criterion has not been crossed; and
- an exam-proximity override.

Module completion may influence what is scheduled, but should not satisfy any of those routes by itself.

### Recommended allocation rule

This is a design inference, informed by spacing/interleaving evidence:

1. Choose the **section first**, with roughly equal VR/DM/QR exposure for a new student. This prevents DM receiving more total time merely because it has more categories.
2. Within VR or DM, choose the least-covered or most-overdue category, then use weakness as a tiebreaker or gradual weighting signal. Treat QR as one readiness unit.
3. Give a new category a short blocked acquisition run, then mix it with older categories in later review/benchmark work.
4. Preserve a small exploration quota so uncovered or uncertain units cannot be starved by noisy weakness scores.

The prior decision of roughly 20 questions across at least two sessions, including one block of at least 10, is a reasonable **initial coverage policy**, but it is not research-validated and should remain tunable.

## Timing progression and the speed–accuracy trade-off

Speed and accuracy must be treated jointly. Psychometric research explicitly distinguishes latent ability from latent speed and item difficulty from item time-intensity; response time alone is not an ability measure. Joint response/response-time models were developed precisely because simpler procedures confound these quantities. ([van der Linden, 2007, doi:10.1007/s11336-006-1478-z](https://doi.org/10.1007/s11336-006-1478-z), [Ranger, Kuhn & Pohl, 2021, doi:10.1080/15366367.2020.1750934](https://doi.org/10.1080/15366367.2020.1750934))

The live UCAT is genuinely speeded. Pearson's 2025 analysis estimated that, after excluding responses of five seconds or less as guesses, only 19% of candidates completed all VR items, 61% all DM items and 41% all QR items; mean non-guess attempt rates were 87%, 96% and 91%. This makes pacing strategy and completion behaviour part of representative readiness, not an incidental metric. ([2025 UCAT technical report, pp. 44–46](https://www.ucat.ac.uk/media/1726/ucat-2025-technical-report-final.pdf))

The design should therefore distinguish three values:

- **prescribed pace**: the time condition the planner sets for the next block;
- **observed pace**: the student's actual response-time behaviour; and
- **exam-pace performance**: accuracy/marks, omissions and pacing on representative 1.0× full sets.

A student who answers very quickly and inaccurately may have 1.3× observed pace but should not be assigned a 1.3× prescribed pace. The prescribed rung should change only after completed evidence at the current rung is replanned; merely scheduling two future blocks must never advance it.

### Candidate pace policy

The following is a defensible starting policy, but its numeric cut-offs require product validation:

1. Use rungs from 0.5× through 1.0× for normal timing progression.
2. Place the initial rung from observed natural pace **capped at 1.0×**, after excluding implausibly fast responses and evaluating accuracy jointly.
3. Advance only after at least two completed blocks at the current prescribed pace and a minimum recent evidence volume (for example, 30 scorable questions).
4. Advance when smoothed recent accuracy is not materially worse than the reliable slower-pace baseline. A five-percentage-point tolerance is a product prior, not an evidence-derived constant.
5. Hold the rung when evidence is uncertain. Reduce it only after sustained deterioration across more than one session, so one bad day does not cause oscillation.
6. Keep periodic full-section calibrations at 1.0× regardless of the targeted-work rung.
7. Permit optional 1.1–1.3× targeted “overspeed” work only after the section has reliable 1.0× evidence and its exam-pace accuracy remains good. Overspeed should not replace 1.0× calibration and should not be the default destination for every student.

This rule directly implements the stated goal: reach exam pace while preserving performance, then use overspeed selectively rather than making 1.3× a universal endpoint.

## Review, spacing and adaptive scheduling

Review should remain explicit after learning and timing work. Feedback experiments support correcting errors and low-confidence correct answers, while retrieval experiments support returning to learned material rather than marking it permanently complete. ([Butler, Karpicke & Roediger, 2008](https://doi.org/10.1037/0278-7393.34.4.918), [Karpicke & Roediger, 2008](https://doi.org/10.1126/science.1152408))

The exact review burden can change by phase:

- learning: explanation-led review of all uncertain/incorrect methods;
- timing: review both wrong answers and questions that were correct but unusually slow;
- exam: trend-led triage, while still reviewing errors that reveal a repeated strategy problem.

Review should not consume the quota for core practice questions, but it still consumes human time. The schedule should therefore estimate **practice time and review time separately**, show both to the student, and protect the core practice allocation rather than pretending review is free.

Spacing evidence argues against an unlimited “repeat as many times as needed” loop on one day. Cepeda and colleagues experimentally varied study gaps and final-test delays in more than 1,350 participants and found that the most useful gap increased with the desired retention interval. Pavlik and Anderson's experimental adaptive scheduler improved recall and recall latency by balancing recency, frequency and increasing spacing. Neither task was UCAT reasoning, but both support revisiting skills over time and using recency/history rather than massing all remedial work immediately. ([Cepeda et al., 2008, doi:10.1111/j.1467-9280.2008.02209.x](https://doi.org/10.1111/j.1467-9280.2008.02209.x), [Pavlik & Anderson, 2008, doi:10.1037/1076-898X.14.2.101](https://doi.org/10.1037/1076-898X.14.2.101))

Do not simply allocate every spare minute to the weakest unit. In Metcalfe and Kornell's experiments, performance was best when the most study time went to medium-difficulty items in the learner's “region of proximal learning”, rather than automatically to the hardest items. Applied to UCAT, this supports prioritising **expected improvement per unit time**, while retaining minimum coverage for very weak units, rather than letting the lowest score dominate indefinitely. ([Metcalfe & Kornell, 2003, doi:10.1037/0096-3445.132.4.530](https://doi.org/10.1037/0096-3445.132.4.530))

A practical section priority can therefore combine:

- target-score gap, discounted when the score estimate is uncertain;
- recency/staleness;
- minimum coverage deficit;
- recent learning gain or estimated opportunity for improvement;
- proximity to an overdue 1.0× calibration; and
- a small exploration floor.

Historical question volume should be diminishing and recency-aware, not a permanent debt: 500 old questions should not outweigh current evidence forever.

## Full-section sets and mock cadence

Full-section sets and mocks have two distinct jobs:

1. **measurement** under representative timing and question mix; and
2. **rehearsal** of pacing, navigation, endurance and recovery between separately timed sections.

The official UCAT materials support using representative timed practice tests nearer the test date, and the national preparation study found their use associated with higher scores. Neither source specifies weekly, twice-weekly or every-other-day mocks. ([official UCAT ANZ practice tests](https://www.ucat.edu.au/prepare/practice-tests/), [Kulkarni, Parry & Sitch, 2022](https://doi.org/10.1186/s12909-022-03811-y))

Consequently:

- an early short diagnostic can be useful, but should not be called sufficient for an initial scaled-score estimate;
- learning should use full-section sets as benchmarks and should not require a full mock merely to graduate;
- timing should schedule a full 1.0× set when a section's calibration is stale, not mechanically every fourth study day;
- full mocks in timing are intermittent benchmarks;
- the two-month exam phase may use about one mock per week initially and rise toward two or three per week in the final month, with roughly 24–48 hours before the real exam protected from a final mock if that is Altitutor's coaching policy.

The last cadence is an **explicit product prior**, not a research finding. Instrument mock completion, subsequent practice quality, self-reported fatigue and score calibration, then tune it. A mock should not be added when it crowds out review or the targeted work that its result would prescribe.

## Target setting

Do not let the student's visible target scores move every time their predicted section strengths change. In an original study of children learning arithmetic, proximal subgoals produced stronger competency, self-efficacy and intrinsic interest than distant goals; transferring that result to UCAT supports stable outcome goals paired with achievable short-horizon process goals. It does not support silently rewriting the outcome target. ([Bandura & Schunk, 1981, doi:10.1037/0022-3514.41.3.586](https://doi.org/10.1037/0022-3514.41.3.586))

Recommended separation:

- **student outcome target**: stable total/section aspiration, changed by the student or at an explicit review;
- **planner allocation target**: an internal, slowly changing distribution of the total target across sections; and
- **next process target**: a near-term pace, accuracy, coverage or calibration goal.

Until Altitutor has calibrated section learning curves, it cannot reliably know which score gain is “easiest”. Start with regularised allocations and change them only at checkpoints with enough representative evidence. Add hysteresis or a weekly maximum update frequency. Optimise schedule priority using target gap and expected learning value, but do not present the internal allocation as a promise.

## Score prediction

### What not to do

Do not:

- linearly map raw percentage to 300–900;
- multiply or subtract accuracy by a fixed slow-time penalty;
- use only the fastest attempts;
- treat targeted weak-category sets as representative of the full section;
- average session percentages without weighting their question/mark counts;
- ignore unattempted questions in standard-time sets;
- score DM only by “questions correct” rather than its one- and two-mark rules; or
- display a point estimate without evidence quality and uncertainty.

UCAT's own process transforms raw marks after form construction, IRT calibration, equating and item analysis, and official practice tests deliberately do not return a scaled score. A third party lacks the live form's proprietary item parameters and exact raw-to-scaled transformation. ([2025 UCAT technical report, pp. 10–11 and 49–58](https://www.ucat.ac.uk/media/1726/ucat-2025-technical-report-final.pdf), [official UCAT ANZ practice tests](https://www.ucat.edu.au/prepare/practice-tests/))

A fixed timing penalty is particularly problematic because the live exam does not subtract marks for taking longer on a particular question; time operates through a section deadline, omissions and rushed/guessed responses. Accuracy and response time also depend on person, item difficulty and item time-intensity, which is why joint psychometric models separate them. ([UCAT ANZ scoring](https://www.ucat.edu.au/about-ucat-anz/scoring/), [van der Linden, 2007](https://doi.org/10.1007/s11336-006-1478-z))

### Recommended two-model design

#### 1. Learning-state model for the planner

Use all valid work to estimate section/category state:

- correctness or marks;
- response time and prescribed pace;
- item/category/tag;
- item difficulty and time-intensity when calibrated;
- session/date and feedback conditions;
- omitted/guessed behaviour; and
- full-set versus targeted context.

At minimum, use Bayesian/binomial shrinkage and question-weighted recency rather than raw averages. With enough cohort responses, progress toward an item-response model and a separate response-time model, or a joint hierarchical model. Quarantine items that have too little evidence or weak discrimination. This state drives what to learn next and whether pace can advance; it is not itself the promised UCAT score.

#### 2. Exam-condition projection for the student

Anchor the displayed score mainly to recent representative evidence:

- full-section sets or mock sections;
- standard 1.0× timing and the student's approved access-arrangement timing;
- feedback withheld until completion;
- blueprint-representative category and response-format mix;
- marks including partial credit, omissions and completion behaviour; and
- calibrated Altitutor item/form difficulty.

Targeted and slower work may update the latent learning state, but should have little or no direct weight in the displayed exam projection until a validated model demonstrates that it improves out-of-sample prediction.

Return a distribution, not only a point: for example, `expected 650; plausible range 600–700; medium evidence`. The range should widen when evidence is old, sparse, non-representative or internally inconsistent. It should not tighten below what validation supports.

### Calibration programme

Altitutor needs an empirical calibration loop before describing the output as a UCAT score prediction:

1. pre-calibrate bank items from cohort response data, with shrinkage for sparse items;
2. construct representative benchmark forms and check reliability/discrimination;
3. collect consented eventual UCAT ANZ section scores and timing/access-arrangement context;
4. train only on data available before each student's real exam;
5. evaluate on later cohorts or held-out students/forms;
6. report mean absolute error, bias, interval coverage and calibration by section, evidence volume and relevant student groups; and
7. monitor yearly drift because official means, timings and scaling can change. UCAT itself reports year-to-year scaling/timing changes and re-calibrates items showing material drift. ([2025 UCAT technical report, pp. 10–14 and 52–58](https://www.ucat.ac.uk/media/1726/ucat-2025-technical-report-final.pdf), [UCAT ANZ historical statistics](https://www.ucat.edu.au/results/test-statistics-2025/))

Until this validation exists, label the output `Altitutor practice estimate`, not an official UCAT prediction.

## Suggested planning policy to take into refinement

This is the most defensible specification implied by the evidence and prior product decisions:

1. Keep section-specific learning/timing state and a global date-driven exam override.
2. Use VR and DM category evidence, QR section evidence, and keep tags as weakness signals rather than gates.
3. Select sections hierarchically before categories so a larger taxonomy does not create more section time.
4. Make modules optional interventions, never substitute evidence for readiness.
5. Advance prescribed pace only from completed, recent, accuracy-conditioned evidence.
6. Make 1.0× the normal timing destination; reserve 1.1–1.3× for optional targeted overspeed after stable exam-pace performance.
7. Trigger full-section benchmarks by section calibration staleness and uncertainty rather than a calendar modulus.
8. Use mock cadence as an explicit, configurable coaching prior and validate it in product data.
9. Bound same-day optional work and re-space unfinished work rather than creating unlimited repetitions or backlog.
10. Centralise planned tasks, “give me more”, and plan-off suggestions behind one candidate-ranking policy; the difference is whether the calendar scheduler selects repeatedly from it.
11. Separate planning readiness from student-facing score prediction.
12. Do not let a changing prediction automatically rewrite the student's visible target.

## Decisions still requiring Altitutor judgement

Research cannot settle these values. They should be resolved explicitly and encoded as tunable policy:

1. What minimum recent evidence volume and number of sessions allow a pace rung to advance?
2. Is “accuracy preserved” an absolute floor, a maximum drop from slower baseline, progress toward the student's section target, or a combination?
3. What exact evidence permits overspeed work, and what proportion of a section's timing work may it occupy?
4. How stale may a section's last representative 1.0× set become in learning, timing and exam phases?
5. Is the early benchmark mock optional diagnostic evidence, or a required learning event? It should not be a score-estimate gate.
6. What bounded workload envelope replaces “repeat as many times as needed” while respecting availability and spacing?
7. Should SJT default to regular, occasional or off? Officially it is a separate 300–900 score in UCAT ANZ, so it should not consume cognitive target-gap weight. ([UCAT ANZ scoring](https://www.ucat.edu.au/about-ucat-anz/scoring/))
8. What minimum bank/cohort calibration quality is required before the interface shows a scaled practice estimate rather than only accuracy, pace and readiness?
9. How often may internal section allocation targets change, and under what minimum evidence?

## Sources reviewed

### Direct UCAT sources

- [UCAT ANZ: Test Format](https://www.ucat.edu.au/about-ucat-anz/test-format/)
- [UCAT ANZ: Scoring](https://www.ucat.edu.au/about-ucat-anz/scoring/)
- [UCAT ANZ: Preparation Advice and Resources](https://www.ucat.edu.au/prepare/)
- [UCAT ANZ: Practice Tests and Question Banks](https://www.ucat.edu.au/prepare/practice-tests/)
- [Pearson/UCAT 2025 Technical Report](https://www.ucat.ac.uk/media/1726/ucat-2025-technical-report-final.pdf)
- [UCAT ANZ 2025 Summary Statistics](https://www.ucat.edu.au/media/1581/summary-statistics-for-2025.pdf)
- [Kulkarni, Parry & Sitch (2022), national UCAT preparation study](https://doi.org/10.1186/s12909-022-03811-y)

### Original broader research

- [Karpicke & Roediger (2008), retrieval practice](https://doi.org/10.1126/science.1152408)
- [Butler, Karpicke & Roediger (2008), feedback](https://doi.org/10.1037/0278-7393.34.4.918)
- [Rohrer & Taylor (2007), spacing and interleaving](https://doi.org/10.1007/s11251-007-9015-8)
- [Cepeda et al. (2008), spacing across retention intervals](https://doi.org/10.1111/j.1467-9280.2008.02209.x)
- [Pavlik & Anderson (2008), adaptive practice scheduling](https://doi.org/10.1037/1076-898X.14.2.101)
- [Metcalfe & Kornell (2003), allocation to a region of proximal learning](https://doi.org/10.1037/0096-3445.132.4.530)
- [Bandura & Schunk (1981), proximal goals](https://doi.org/10.1037/0022-3514.41.3.586)
- [van der Linden (2007), joint modeling of response accuracy and time](https://doi.org/10.1007/s11336-006-1478-z)
- [Ranger, Kuhn & Pohl (2021), speed–accuracy trade-off in tests](https://doi.org/10.1080/15366367.2020.1750934)

## Limitations

There appears to be no randomised trial comparing UCAT study-plan algorithms, readiness gates, pace ladders or mock schedules. The only located large UCAT preparation study is observational, based on 2017 UK candidates and self-reported preparation. The broader experiments use vocabulary, factual, mathematical or generic test tasks; their principles are plausible for UCAT but the exact planner policies remain inferences. The 2025 Pearson technical report describes official operational psychometrics, not a recipe a commercial question bank can reproduce without calibrated items and outcome data.
