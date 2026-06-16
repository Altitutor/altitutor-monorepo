-- Seed editable category-level prompt layers for UCAT AI generation.
-- These prompts are intentionally concise; admin-web can refine them over time.

INSERT INTO public.ucat_ai_generation_prompt_layers (
  scope_type,
  scope_id,
  prompt_text,
  prompt_version,
  is_enabled
)
SELECT
  'stem_category',
  qsc.id,
  CASE qsc.name
    WHEN 'Reading Comprehension' THEN
      'Generate Verbal Reasoning reading comprehension passages with exactly four questions and four options per question. Questions should test inference, detail retrieval, author attitude, and careful wording without requiring outside knowledge.'
    WHEN 'True, False, Can''t Tell' THEN
      'Generate Verbal Reasoning True/False/Can''t Tell passages with exactly four questions. Each question must use the exact options True, False, and Can''t tell, and the explanation must distinguish contradicted, supported, and not-given information.'
    WHEN 'Syllogisms' THEN
      'Generate Decision Making syllogisms with a clear set of premises, exactly five conclusions, and Yes/No answers. Explanations must refer only to logical consequence, not real-world plausibility.'
    WHEN 'Recognising Assumptions' THEN
      'Generate Decision Making recognising assumptions items where the question text is exactly "Select the strongest argument from the statements below." Use one strongest option and plausible weaker distractors.'
    WHEN 'Venn Diagrams' THEN
      'Generate Decision Making Venn diagram items only when the stem includes enough structured set data to support a deterministic diagram. Prefer simple, inspectable quantities over decorative visuals.'
    WHEN 'Drawing Conclusions' THEN
      'Generate Decision Making drawing-conclusions items where the correct answer follows from the supplied data or statements, and distractors fail because they overreach, reverse a relation, or ignore a condition.'
    WHEN 'Probabilistic and Statistical Reasoning' THEN
      'Generate Decision Making probability and statistics items with explicit denominators, base rates, or summary data. Avoid hidden assumptions and make the calculation auditable.'
    WHEN 'Logical Puzzles' THEN
      'Generate Decision Making logical puzzles with compact rules and one unambiguous solution path. Keep the burden appropriate for UCAT timing.'
    WHEN 'How Appropriate' THEN
      'Generate Situational Judgement scenarios using the How Appropriate answer scale exactly. Explanations should acknowledge professional nuance while identifying the best judgement.'
    WHEN 'How Important' THEN
      'Generate Situational Judgement scenarios using the How Important answer scale exactly. Explanations should distinguish priority, patient safety, professionalism, and relevance.'
    WHEN 'Data Tables' THEN
      'Generate Quantitative Reasoning stems based on clean data tables. Include realistic units, one to four questions, exactly five options per question, and worked explanations.'
    WHEN 'Graphs and Charts' THEN
      'Generate Quantitative Reasoning stems based on deterministic graph or chart data. Use structured visual specs only when the chart carries examinable data.'
    WHEN 'Timetables and Calendars' THEN
      'Generate Quantitative Reasoning stems involving schedules, calendars, time intervals, or rates over time. Ensure all conversions and date/time assumptions are explicit.'
    WHEN 'Maps and Diagrams' THEN
      'Generate Quantitative Reasoning stems using simple deterministic schematic diagrams only when spatial or geometric information is necessary for the calculation.'
    WHEN 'Mixed Data Sources' THEN
      'Generate Quantitative Reasoning stems combining two or more compact data sources, such as a table plus short text or chart. Avoid clutter that raises time burden beyond the selected target.'
    WHEN 'Text-Only Scenarios' THEN
      'Generate Quantitative Reasoning stems where all needed numerical information is in concise prose. Keep quantities realistic and avoid unnecessary tables.'
    ELSE
      'Generate UCAT-style stems that fit this category exactly, with unambiguous answers, realistic difficulty, and concise tutor-review explanations.'
  END,
  1,
  true
FROM public.question_stem_categories qsc
WHERE qsc.name IN (
  'Reading Comprehension',
  'True, False, Can''t Tell',
  'Syllogisms',
  'Recognising Assumptions',
  'Venn Diagrams',
  'Drawing Conclusions',
  'Probabilistic and Statistical Reasoning',
  'Logical Puzzles',
  'How Appropriate',
  'How Important',
  'Data Tables',
  'Graphs and Charts',
  'Timetables and Calendars',
  'Maps and Diagrams',
  'Mixed Data Sources',
  'Text-Only Scenarios'
)
ON CONFLICT (scope_type, scope_id) DO NOTHING;
