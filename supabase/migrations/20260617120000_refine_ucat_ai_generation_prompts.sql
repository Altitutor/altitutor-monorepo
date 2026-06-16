-- Refine UCAT AI generation prompts against official-style UCAT ANZ practice material.
-- Existing prompt/profile migrations have already been applied remotely, so this is a forward-only seed update.

WITH prompt_values AS (
  SELECT
    $system$Generate UCAT ANZ tutor-review drafts that should need minimal editing before approval. Return JSON only.

Calibrate to official UCAT practice style: concise stems, ordinary real-world contexts, precise wording, plausible distractors, strict answer formats, and no teaching-style scaffolding.

Do not copy source examples, distinctive premises, data relationships, names, or near-exact wording. Use examples only to calibrate style, length, difficulty, and answer format.

Every answer must be independently defensible from the supplied stem. Explanations must be student-facing, concise, and must explain the decisive reasoning rather than merely restating the answer.$system$ AS base_system_prompt,
    $planner$Plan more candidates than will be surfaced, then make them genuinely different.

For every planned candidate specify:
- the exact UCAT section and category;
- the scenario or data domain;
- the reasoning operation being tested;
- the intended difficulty and time burden;
- the distractor strategy;
- the specific official-style feature it is imitating, without copying content.

Use mixed difficulty to create a realistic spread: mostly medium, some easy, some hard. Prefer clean, testable constraints over decorative complexity.$planner$ AS planner_prompt,
    $writer$Write near-publishable UCAT candidates from the plan.

Respect the output schema exactly. Make stems compact, information-dense, and self-contained. Use tables or deterministic visual specs only when the data structure is part of the reasoning.

For every multiple-choice question, produce one unambiguously correct answer and plausible distractors that represent common candidate errors. For every syllogism option, mark Yes or No through isAnswer and explain the logical consequence.

For every question-level explanation, include the decisive calculation, textual evidence, logical constraint, or professional judgement. Also explain why the strongest distractor fails.$writer$ AS writer_prompt,
    $critic$Act as a strict UCAT ANZ moderator.

Independently solve each candidate before judging it. Block objective answer errors, unsupported conclusions, copied or near-copied source material, wrong option counts, wrong category format, ambiguous objective items, impossible calculations, and explanations that do not support the keyed answer.

Warn, rather than block, for mild style issues, slightly thin distractors, small difficulty mismatches, or Situational Judgement / Verbal Reasoning nuance where more than one response is plausible but the intended answer is still defensible.

Score UCAT-likeness by official-style brevity, cognitive load, plausibility of distractors, answer validity, and fit to the selected section/category.$critic$ AS critic_prompt,
    $rewriter$Rewrite only salvageable candidates.

Fix the listed issues while preserving the selected section, category, answer format, and intended difficulty. If an issue requires changing the underlying premise, rebuild the smallest possible part of the stem and all affected answers/explanations.

Do not add long teaching text. Keep the rewritten candidate in official-style UCAT form and return exactly one candidate in the required JSON shape.$rewriter$ AS rewriter_prompt
)
UPDATE public.ucat_ai_generation_profiles profile
SET
  base_system_prompt = prompt_values.base_system_prompt,
  planner_prompt = prompt_values.planner_prompt,
  writer_prompt = prompt_values.writer_prompt,
  critic_prompt = prompt_values.critic_prompt,
  rewriter_prompt = prompt_values.rewriter_prompt,
  profile_version = CASE
    WHEN profile.base_system_prompt IS DISTINCT FROM prompt_values.base_system_prompt
      OR profile.planner_prompt IS DISTINCT FROM prompt_values.planner_prompt
      OR profile.writer_prompt IS DISTINCT FROM prompt_values.writer_prompt
      OR profile.critic_prompt IS DISTINCT FROM prompt_values.critic_prompt
      OR profile.rewriter_prompt IS DISTINCT FROM prompt_values.rewriter_prompt
    THEN profile.profile_version + 1
    ELSE profile.profile_version
  END,
  updated_at = NOW()
FROM prompt_values
WHERE profile.id = '12d1804c-306b-45f1-9aac-f3e1596955a0';

WITH section_prompts(section_name, prompt_text) AS (
  VALUES
    (
      'Verbal Reasoning',
      $prompt$Official-style Verbal Reasoning uses a 2-6 paragraph passage followed by four questions. The passage should read like a compact factual article, historical/scientific commentary, cultural note, or balanced argument. It should include enough detail for inference, author attitude, purpose, exact wording, and not-given distinctions.

Questions must be answerable from the passage alone. Avoid outside knowledge and generic comprehension checks. Distractors should be attractive because they overstate, reverse, use the wrong scope, confuse cause and correlation, import unsupported information, or match only part of the passage.$prompt$
    ),
    (
      'Decision Making',
      $prompt$Official-style Decision Making is standalone and concise. Use precise rules, set relationships, rankings, short policy questions, tables, simple equations, probability facts, or compact logical conditions.

The correct answer must follow only from the supplied information. Distractors should fail through a named reasoning error: necessary/sufficient confusion, reversed condition, unsupported assumption, arithmetic slip, wrong denominator, irrelevant argument, or ignored constraint. Do not rely on real-world plausibility unless the category is an argument-strength item.$prompt$
    ),
    (
      'Quantitative Reasoning',
      $prompt$Official-style Quantitative Reasoning uses compact data sources and five numeric options per question. Stems often reuse one table, graph, chart, pricing schedule, rate comparison, or short scenario across 1-4 questions.

Use realistic units and values. Ask for one or two efficient operations plus interpretation, not long algebra. Distractors should reflect common UCAT errors: rounding too early, inverse ratios, wrong denominator, percentage point versus percentage change, unit conversion, transposed table entry, or reading the wrong data series.$prompt$
    ),
    (
      'Situational Judgement',
      $prompt$Official-style Situational Judgement uses brief clinical or training scenarios involving students, junior doctors, patients, colleagues, supervisors, wards, clinics, confidentiality, consent, safety, honesty, respect, teamwork, or escalation.

Each question should rate one consideration or one action. The best answer should reflect patient safety, professional integrity, scope of practice, confidentiality, seeking help, respectful communication, and proportional escalation. Explanations should acknowledge nuance without becoming generic professionalism advice.$prompt$
    )
)
INSERT INTO public.ucat_ai_generation_prompt_layers (
  scope_type,
  scope_id,
  prompt_text,
  prompt_version,
  is_enabled
)
SELECT
  'section',
  section.id,
  section_prompts.prompt_text,
  1,
  true
FROM section_prompts
JOIN public.ucat_sections section ON section.name = section_prompts.section_name
ON CONFLICT (scope_type, scope_id) DO UPDATE
SET
  prompt_text = EXCLUDED.prompt_text,
  prompt_version = CASE
    WHEN public.ucat_ai_generation_prompt_layers.prompt_text IS DISTINCT FROM EXCLUDED.prompt_text
    THEN public.ucat_ai_generation_prompt_layers.prompt_version + 1
    ELSE public.ucat_ai_generation_prompt_layers.prompt_version
  END,
  is_enabled = true,
  updated_at = NOW();

WITH category_prompts(category_name, prompt_text) AS (
  VALUES
    (
      'Reading Comprehension',
      $prompt$Generate a compact passage with exactly four four-option questions. Use official-style question focuses: best supported statement, main purpose, author attitude, implication, detail retrieval with a twist, or meaning in context.

Options should be parallel in grammar and length where possible. The right answer should be defensible from one or two specific parts of the passage. Wrong answers should be plausible but fail by being too broad, too strong, contradicted, only partly supported, or outside the passage.$prompt$
    ),
    (
      'True, False, Can''t Tell',
      $prompt$Generate a compact passage with exactly four questions. Every question must use the options in this order: True, False, Can't Tell.

A True item must be directly supported. A False item must be directly contradicted. A Can't Tell item must be plausible but not established, not merely hard to find. Mix all three answer types across the four questions when possible. Explanations must name the evidence gap or contradiction.$prompt$
    ),
    (
      'Syllogisms',
      $prompt$Generate a short set of premises followed by exactly five conclusions. The question text must be exactly: Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.

Store this as one syllogism question with five options. Each option is a conclusion statement; isAnswer means the correct response is Yes, and false means No. Test formal consequence only. Include some conclusions that are tempting because they sound realistic but are not logically forced.$prompt$
    ),
    (
      'Recognising Assumptions',
      $prompt$Generate one balanced public-policy or everyday decision question, then exactly four arguments. The question text must be exactly: Select the strongest argument from the statements below.

The strongest argument should be directly relevant, evidence-based, and decisive for the question. Weaker arguments should be emotional, circular, tangential, too narrow, unsupported, based on an assumption, or true but not decisive. Avoid medical ethics content here unless it is clearly an argument-strength task, not SJT.$prompt$
    ),
    (
      'Venn Diagrams',
      $prompt$Generate a compact set-membership item that can be represented by two or three overlapping groups. Include all numbers or conditions needed for a deterministic answer.

Prefer a small table or short prose over decorative visuals. If using a visual block, use visualType "venn_diagram" and include exact set labels, region counts, and any unknowns in spec. Distractors should reflect double-counting, missing intersections, or confusing "only" with inclusive membership.$prompt$
    ),
    (
      'Drawing Conclusions',
      $prompt$Generate a short data, rule, or statement set followed by one question asking which conclusion follows. The correct option should be the only conclusion supported by the supplied information.

Distractors should overreach, reverse a relationship, ignore a condition, infer causation from association, use outside knowledge, or select a statement that may be true but is not proven.$prompt$
    ),
    (
      'Probabilistic and Statistical Reasoning',
      $prompt$Generate one probability or statistics item with explicit denominators, base rates, group counts, averages, ranges, or summary data.

Keep calculations auditable under UCAT timing. Make the correct answer depend on choosing the right sample space, denominator, conditional group, expected value, or comparison. Distractors should reflect common denominator swaps, assuming independence, averaging percentages incorrectly, or using total counts when a subgroup is required.$prompt$
    ),
    (
      'Logical Puzzles',
      $prompt$Generate a compact rule-based puzzle with one unambiguous solution path. Good forms include order/ranking, scheduling, ages, coded symbols, seating, allocation, or conditional eligibility.

Keep the stem short enough for timed reasoning. Provide 4-5 answer options. Distractors should each satisfy some constraints while violating one hidden or late constraint. Avoid puzzles that require trialling too many cases.$prompt$
    ),
    (
      'How Appropriate',
      $prompt$Generate a brief clinical or training scenario with exactly four questions using the How Appropriate scale in this exact order: A very appropriate thing to do; Appropriate, but not ideal; Inappropriate, but not awful; A very inappropriate thing to do.

Each question should rate one possible response. Use realistic actions involving communication, escalation, confidentiality, honesty, scope of practice, safety, respect, or teamwork. Explanations should distinguish ideal action from acceptable but incomplete action and serious professionalism breaches from minor imperfections.$prompt$
    ),
    (
      'How Important',
      $prompt$Generate a brief clinical or training scenario with exactly four questions using the How Important scale in this exact order: Very important; Important; Of minor importance; Not important at all.

Each question should rate one consideration, not an action bundle. Very important should affect immediate safety, legality, consent, confidentiality, or urgent escalation. Important should matter but not dominate. Of minor importance should be peripheral. Not important at all should be irrelevant or inappropriate to consider.$prompt$
    ),
    (
      'Data Tables',
      $prompt$Generate QR stems based on a clean table with realistic labels and units. Use 1-4 questions and exactly five options per question.

Ask for table lookup plus calculation: totals, differences, ratios, percentages, averages, comparisons, rankings, or unit conversions. Distractors should use wrong row/column, wrong total, early rounding, or arithmetic slips.$prompt$
    ),
    (
      'Graphs and Charts',
      $prompt$Generate QR stems based on deterministic graph or chart data. Use visual blocks only when the chart carries examinable data, and include exact series, labels, values, units, and axis meaning in spec.

Questions should require reading the correct series, comparing values, converting percentages to quantities, identifying change over time, or combining chart values with a short extra fact. Distractors should reflect misread axes, wrong series, percentage point errors, and rounded approximations.$prompt$
    ),
    (
      'Timetables and Calendars',
      $prompt$Generate QR stems involving schedules, dates, calendars, time intervals, travel durations, rates over time, or availability windows.

Make all assumptions explicit: start/end times, inclusivity, time zones only if needed, days counted, breaks, frequency, and units. Distractors should reflect off-by-one days, AM/PM mistakes, inclusive/exclusive counting, or rate/time inversion.$prompt$
    ),
    (
      'Maps and Diagrams',
      $prompt$Generate QR stems using a simple deterministic map, route, geometry, scale, or schematic only when spatial information is necessary.

If using a visual block, use visualType "schematic_map" and include exact distances, labels, directions, scale, and constraints in spec. Questions should test distance, area, perimeter, speed, scale, route comparison, or geometric interpretation without relying on a decorative image.$prompt$
    ),
    (
      'Mixed Data Sources',
      $prompt$Generate QR stems combining two compact sources, such as a table plus short text, chart plus formula, price list plus discount rule, or timetable plus rate.

Keep the sources readable under UCAT timing. Each question should require selecting the relevant source and combining it with one additional operation. Avoid clutter. Distractors should use the right calculation on the wrong source or omit one condition.$prompt$
    ),
    (
      'Text-Only Scenarios',
      $prompt$Generate QR stems where all necessary numbers appear in concise prose. Use realistic everyday contexts such as pricing, travel, recipes, staffing, medicine quantities, events, energy, sport, or budgets.

Do not create an unnecessary table. Questions should test calculation from prose: ratios, rates, percentages, averages, conversions, differences, totals, or simple equations. Distractors should reflect misread wording or wrong operation, not random numbers.$prompt$
    )
)
INSERT INTO public.ucat_ai_generation_prompt_layers (
  scope_type,
  scope_id,
  prompt_text,
  prompt_version,
  is_enabled
)
SELECT
  'stem_category',
  category.id,
  category_prompts.prompt_text,
  2,
  true
FROM category_prompts
JOIN public.question_stem_categories category ON category.name = category_prompts.category_name
ON CONFLICT (scope_type, scope_id) DO UPDATE
SET
  prompt_text = EXCLUDED.prompt_text,
  prompt_version = CASE
    WHEN public.ucat_ai_generation_prompt_layers.prompt_text IS DISTINCT FROM EXCLUDED.prompt_text
    THEN public.ucat_ai_generation_prompt_layers.prompt_version + 1
    ELSE public.ucat_ai_generation_prompt_layers.prompt_version
  END,
  is_enabled = true,
  updated_at = NOW();
