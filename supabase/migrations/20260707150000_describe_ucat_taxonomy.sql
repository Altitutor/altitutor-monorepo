-- Add human-readable descriptions to UCAT stem categories and question tags.
-- Descriptions are stored as one-paragraph ProseMirror JSONB documents so they
-- display correctly in existing tutor taxonomy editors and selectors.

CREATE OR REPLACE FUNCTION public.__tmp_ucat_taxonomy_description_doc(p_text TEXT)
RETURNS JSONB
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'type', 'doc',
    'content', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph',
        'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', p_text)
        )
      )
    )
  );
$$;

WITH category_descriptions(section_name, category_name, description_text) AS (
  VALUES
    ('Verbal Reasoning', 'Reading Comprehension', 'Passage-based Verbal Reasoning questions with four answer options that test understanding, inference, evidence use, and author meaning.'),
    ('Verbal Reasoning', 'True, False, Can''t Tell', 'Verbal Reasoning questions where each statement must be judged as true, false, or not provable from the passage.'),
    ('Decision Making', 'Logical Puzzles', 'Rule-based Decision Making questions that require applying constraints, ordering, matching, selection, or spatial relationships.'),
    ('Decision Making', 'Probabilistic and Statistical Reasoning', 'Decision Making questions that require probability, statistics, expected value, or interpretation of numerical evidence.'),
    ('Decision Making', 'Recognising Assumptions', 'Decision Making questions that ask for the strongest argument or assumption behind a claim, policy, or proposed action.'),
    ('Decision Making', 'Syllogisms', 'Decision Making yes/no conclusion questions that test whether statements necessarily follow from given premises.'),
    ('Decision Making', 'Venn Diagrams', 'Decision Making questions that use set relationships or Venn-style regions to reason about membership, overlap, and complements.'),
    ('Quantitative Reasoning', 'Data Tables', 'Quantitative Reasoning stems where the main source is one or more tables of values.'),
    ('Quantitative Reasoning', 'Graphs and Charts', 'Quantitative Reasoning stems where the main source is a graph, chart, plotted trend, or visual data display.'),
    ('Quantitative Reasoning', 'Timetables and Calendars', 'Quantitative Reasoning stems centred on schedules, calendars, time slots, departures, or durations.'),
    ('Quantitative Reasoning', 'Maps and Diagrams', 'Quantitative Reasoning stems that rely on maps, plans, diagrams, layouts, or other spatial visuals.'),
    ('Quantitative Reasoning', 'Mixed Data Sources', 'Quantitative Reasoning stems that require combining information from more than one source type, such as a table plus a chart or diagram.'),
    ('Quantitative Reasoning', 'Text-Only Scenarios', 'Quantitative Reasoning stems where all relevant numerical information is given in prose without a table or visual source.'),
    ('Situational Judgement', 'How Appropriate', 'Situational Judgement questions asking how appropriate a proposed action is in a clinical, educational, or professional scenario.'),
    ('Situational Judgement', 'How Important', 'Situational Judgement questions asking how important a consideration is when deciding what to do in a clinical, educational, or professional scenario.')
)
UPDATE public.question_stem_categories category
SET
  description = public.__tmp_ucat_taxonomy_description_doc(category_descriptions.description_text),
  updated_at = NOW()
FROM category_descriptions
JOIN public.ucat_sections section
  ON section.name = category_descriptions.section_name
WHERE category.ucat_section_id = section.id
  AND category.name = category_descriptions.category_name;

WITH category_descriptions(section_name, category_name) AS (
  VALUES
    ('Verbal Reasoning', 'Reading Comprehension'),
    ('Verbal Reasoning', 'True, False, Can''t Tell'),
    ('Decision Making', 'Logical Puzzles'),
    ('Decision Making', 'Probabilistic and Statistical Reasoning'),
    ('Decision Making', 'Recognising Assumptions'),
    ('Decision Making', 'Syllogisms'),
    ('Decision Making', 'Venn Diagrams'),
    ('Quantitative Reasoning', 'Data Tables'),
    ('Quantitative Reasoning', 'Graphs and Charts'),
    ('Quantitative Reasoning', 'Timetables and Calendars'),
    ('Quantitative Reasoning', 'Maps and Diagrams'),
    ('Quantitative Reasoning', 'Mixed Data Sources'),
    ('Quantitative Reasoning', 'Text-Only Scenarios'),
    ('Situational Judgement', 'How Appropriate'),
    ('Situational Judgement', 'How Important')
)
UPDATE public.question_stem_categories category
SET
  description = public.__tmp_ucat_taxonomy_description_doc(
    COALESCE(section.name || ' stem category for ' || category.name || '.', 'UCAT stem category for ' || category.name || '.')
  ),
  updated_at = NOW()
FROM public.ucat_sections section
WHERE category.ucat_section_id = section.id
  AND NOT EXISTS (
    SELECT 1
    FROM category_descriptions known
    WHERE known.section_name = section.name
      AND known.category_name = category.name
  )
  AND (
    category.description IS NULL
    OR category.description = '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb
  );

WITH RECURSIVE tag_paths AS (
  SELECT
    tag.id,
    tag.name,
    tag.parent_question_tag_id,
    tag.ucat_section_id,
    section.name AS section_name,
    tag.name AS root_name,
    tag.name AS path,
    0 AS depth
  FROM public.question_tags tag
  LEFT JOIN public.ucat_sections section
    ON section.id = tag.ucat_section_id
  WHERE tag.parent_question_tag_id IS NULL

  UNION ALL

  SELECT
    child.id,
    child.name,
    child.parent_question_tag_id,
    parent.ucat_section_id,
    parent.section_name,
    parent.root_name,
    parent.path || ' / ' || child.name,
    parent.depth + 1
  FROM public.question_tags child
  JOIN tag_paths parent
    ON parent.id = child.parent_question_tag_id
),
tag_descriptions AS (
  SELECT
    id,
    CASE
      WHEN depth = 0 THEN
        CASE
          WHEN section_name = 'Verbal Reasoning' AND root_name = 'Evidence handling'
            THEN 'Verbal Reasoning tags for locating, comparing, and evaluating passage evidence.'
          WHEN section_name = 'Verbal Reasoning' AND root_name = 'Author and passage meaning'
            THEN 'Verbal Reasoning tags for interpreting the passage as a whole, including main ideas, author purpose, opinions, and argument support.'
          WHEN section_name = 'Verbal Reasoning' AND root_name = 'Question wording traps'
            THEN 'Verbal Reasoning tags for wording features that often make questions harder to parse, such as qualifiers, negatives, long statements, or missing keywords.'
          WHEN section_name = 'Verbal Reasoning' AND root_name = 'Application'
            THEN 'Verbal Reasoning tags for applying passage ideas to new evidence, hypothetical situations, or changed assumptions.'
          WHEN section_name = 'Decision Making' AND root_name = 'Deductive logic'
            THEN 'Decision Making tags for formal reasoning with quantifiers, conditionals, negation, and necessary conclusions.'
          WHEN section_name = 'Decision Making' AND root_name = 'Rule-based problem solving'
            THEN 'Decision Making tags for constraint puzzles involving ordering, matching, seating, scheduling, selection, or multi-step deduction.'
          WHEN section_name = 'Decision Making' AND root_name = 'Set and Venn reasoning'
            THEN 'Decision Making tags for set membership, Venn regions, overlaps, unions, complements, and diagram selection.'
          WHEN section_name = 'Decision Making' AND root_name = 'Probability and data reasoning'
            THEN 'Decision Making tags for probability, statistics, tables, comparisons, expected value, and risk reasoning.'
          WHEN section_name = 'Decision Making' AND root_name = 'Argument evaluation'
            THEN 'Decision Making tags for assessing arguments, assumptions, evidence strength, relevance, feasibility, and policy or public benefit.'
          WHEN section_name = 'Decision Making' AND root_name = 'Decision wording traps'
            THEN 'Decision Making tags for wording constraints that affect what can be concluded, compared, or considered.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Arithmetic'
            THEN 'Quantitative Reasoning tags for core numerical operations and calculator-free number handling.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Fractions'
            THEN 'Quantitative Reasoning tags for fraction operations, equivalence, simplification, and conversion.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Decimals'
            THEN 'Quantitative Reasoning tags for decimal operations, place value, conversion, and rounding.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Percentages'
            THEN 'Quantitative Reasoning tags for percentage calculations, percentage change, reverse percentages, and compound changes.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Ratios'
            THEN 'Quantitative Reasoning tags for simplifying, comparing, interpreting, and sharing quantities in ratios.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Proportion'
            THEN 'Quantitative Reasoning tags for direct proportion, inverse proportion, and scaling relationships.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Speed - Distance - Time'
            THEN 'Quantitative Reasoning tags for speed, distance, time, rate, and journey calculations.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Unit Conversions'
            THEN 'Quantitative Reasoning tags for converting between measurement units, time units, currencies, and related scales.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Averages'
            THEN 'Quantitative Reasoning tags for mean, median, mode, range, and summary measures.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Basic Statistics'
            THEN 'Quantitative Reasoning tags for comparing datasets, reading summary statistics, interpreting trends, and comparing percentages or means.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Tables and Financial Maths'
            THEN 'Quantitative Reasoning tags for financial tables, profit, loss, discounts, tax, margins, mark-up, and interest.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Algebra'
            THEN 'Quantitative Reasoning tags for algebraic setup, unknowns, equations, and symbolic relationships.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Probability'
            THEN 'Quantitative Reasoning tags for chance, expected outcomes, and probability calculations.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Geometry'
            THEN 'Quantitative Reasoning tags for area, perimeter, volume, circumference, and geometric shapes.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Time Calculations'
            THEN 'Quantitative Reasoning tags for timetables, scheduling, durations, and time zones.'
          WHEN section_name = 'Quantitative Reasoning' AND root_name = 'Multi-Step Calculations'
            THEN 'Quantitative Reasoning tags for questions that require several linked calculations or intermediate results.'
          WHEN section_name = 'Situational Judgement' AND root_name = 'Patient welfare and safety'
            THEN 'Situational Judgement tags for scenarios involving patient safety, welfare, competence, infection risk, or escalation of concerns.'
          WHEN section_name = 'Situational Judgement' AND root_name = 'Professional conduct'
            THEN 'Situational Judgement tags for professionalism, honesty, accountability, confidentiality, respect, dignity, and following protocol.'
          WHEN section_name = 'Situational Judgement' AND root_name = 'Teamwork and communication'
            THEN 'Situational Judgement tags for working with colleagues, speaking up, seeking support, managing conflict, and patient interaction.'
          WHEN section_name = 'Situational Judgement' AND root_name = 'Personal judgement'
            THEN 'Situational Judgement tags for workload, wellbeing, commitments, opportunities, and peer pressure.'
          WHEN section_name = 'Situational Judgement' AND root_name = 'Ethical principles'
            THEN 'Situational Judgement tags for core medical ethics principles such as beneficence, non-maleficence, autonomy, justice, consent, and confidentiality.'
          ELSE COALESCE(section_name || ' question tag group for ' || root_name || '.', 'UCAT question tag group for ' || root_name || '.')
        END
      WHEN section_name = 'Verbal Reasoning'
        THEN 'Verbal Reasoning questions testing ' || lower(name) || ' within ' || path || '.'
      WHEN section_name = 'Decision Making'
        THEN 'Decision Making questions involving ' || lower(name) || ' within ' || path || '.'
      WHEN section_name = 'Quantitative Reasoning'
        THEN 'Quantitative Reasoning questions involving ' || lower(name) || ' within ' || path || '.'
      WHEN section_name = 'Situational Judgement'
        THEN 'Situational Judgement scenarios involving ' || lower(name) || ' within ' || path || '.'
      ELSE 'UCAT questions involving ' || lower(name) || ' within ' || path || '.'
    END AS description_text
  FROM tag_paths
)
UPDATE public.question_tags tag
SET
  description = public.__tmp_ucat_taxonomy_description_doc(tag_descriptions.description_text),
  updated_at = NOW()
FROM tag_descriptions
WHERE tag.id = tag_descriptions.id;

DROP FUNCTION public.__tmp_ucat_taxonomy_description_doc(TEXT);
