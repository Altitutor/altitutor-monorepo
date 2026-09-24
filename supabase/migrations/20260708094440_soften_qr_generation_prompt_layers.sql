WITH qr_category_prompts(category_name, prompt_text) AS (
  VALUES
    (
      'Data Tables',
      $prompt$Use this layer as QR source-shape guidance, not a rigid template.

Data Tables is the best classification when the main examinable information is a table or compact grid. Realistic QR table sources may be financial, medical, transport, sport, staffing, stock, booking, rate, or summary-statistics contexts. A table can be paired with a short rule, footnote, unit conversion, or pricing condition when that makes the item more exam-like.

If this category was explicitly selected, include a table-like source. If it was not explicitly selected, do not force a table; classify as Data Tables only after the source naturally fits. Questions should test row/column selection plus one or two operations such as totals, differences, ratios, percentages, averages, rankings, unit conversions, or cheapest/largest/smallest comparisons. Distractors should be plausible table-reading or calculation traps, not arbitrary numbers.$prompt$
    ),
    (
      'Graphs and Charts',
      $prompt$Use this layer as QR source-shape guidance, not a rigid chart template.

Graphs and Charts is the best classification when the student must read values, trends, proportions, or comparisons from a chart before calculating. Realistic UCAT-style charts can be bar, grouped/stacked bar, line, multi-line, scatter, dot/strip, small-multiple, annotated, or mixed chart/table visuals when appropriate.

If this category was explicitly selected, include chart data as a structured visual. If it was not explicitly selected, do not force a chart; classify as Graphs and Charts only after the source naturally fits. Avoid generic chart clones. Vary axis treatment, labels, data density, units, series structure, and the calculation asked. Distractors should reflect misread axes, wrong series, percentage-point errors, rounding, or using the right operation on the wrong value.$prompt$
    ),
    (
      'Timetables and Calendars',
      $prompt$Use this layer as QR source-shape guidance, not a rigid timetable template.

Timetables and Calendars is the best classification when the core difficulty is handling dates, times, schedules, durations, frequencies, availability windows, opening hours, or journeys over time. The source may be a timetable, a compact table, a text schedule, or a visually dense schedule grid.

If this category was explicitly selected, make time/date reasoning central. If it was not explicitly selected, do not force a schedule; classify here only after the generated source naturally depends on time or calendar interpretation. Make all assumptions explicit: start/end times, inclusivity, AM/PM, breaks, time zones only if needed, frequency, and units. Distractors should reflect off-by-one days, inclusive/exclusive counting, AM/PM mistakes, wrong interval, or rate/time inversion.$prompt$
    ),
    (
      'Maps and Diagrams',
      $prompt$Use this layer as QR source-shape guidance, not a rigid map template.

Maps and Diagrams is the best classification when a spatial source carries examinable quantitative information: route networks, distance diagrams, floor plans, seating/layout grids, scale drawings, geometry sketches, maps, or schematic diagrams. The diagram should exist because it is useful for the calculation, not as decoration.

If this category was explicitly selected, include a spatial or diagrammatic source. If it was not explicitly selected, do not force a map or diagram; classify here only after the source naturally fits. Questions should test distance, area, perimeter, scale, route comparison, speed, coordinates, position, or geometric interpretation. Distractors should reflect wrong route, wrong scale, missed segment, unit conversion, or using a visually adjacent but incorrect value.$prompt$
    ),
    (
      'Mixed Data Sources',
      $prompt$Use this layer as QR source-shape guidance, not a requirement to overload the stem.

Mixed Data Sources is the best classification when the student must combine information from more than one source type, such as a table plus chart, short text plus rate card, timetable plus rule, map plus distance table, or price list plus discount condition. The mix should be compact and readable under UCAT timing.

If this category was explicitly selected, include genuinely linked sources. If it was not explicitly selected, classify as Mixed Data Sources only when the generated source naturally requires combining sources. Do not add a second source merely to satisfy the label. Each question should require identifying the relevant source and applying one additional operation. Distractors should use one correct source but miss the other, apply the right calculation to the wrong source, or omit a condition.$prompt$
    ),
    (
      'Text-Only Scenarios',
      $prompt$Use this layer as QR source-shape guidance, not a ban on structure when a table would be more realistic.

Text-Only Scenarios is the best classification when all relevant numerical information is naturally embedded in concise prose and the first skill is extracting and organising quantities. Good contexts include pricing, travel, recipes, staffing, medicine quantities, events, energy, sport, budgets, or short comparisons.

If this category was explicitly selected, keep the source prose-only unless a tiny inline list is unavoidable. If it was not explicitly selected, do not force prose-only; classify here only when the generated source naturally contains no table or visual. Questions should test ratios, rates, percentages, averages, conversions, differences, totals, simple equations, or reverse calculations from wording. Distractors should reflect misread wording, wrong operation, wrong denominator, or missed condition.$prompt$
    )
)
UPDATE public.ucat_ai_generation_prompt_layers layer
SET
  prompt_text = qr_category_prompts.prompt_text,
  prompt_version = layer.prompt_version + 1,
  updated_at = NOW()
FROM qr_category_prompts
JOIN public.question_stem_categories category
  ON category.name = qr_category_prompts.category_name
JOIN public.ucat_sections section
  ON section.id = category.ucat_section_id
WHERE
  layer.scope_type = 'stem_category'
  AND layer.scope_id = category.id
  AND section.name = 'Quantitative Reasoning'
  AND layer.prompt_text IS DISTINCT FROM qr_category_prompts.prompt_text;
