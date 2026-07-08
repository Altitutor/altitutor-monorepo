export type AiGenerationSectionKey =
  | 'verbal_reasoning'
  | 'decision_making'
  | 'quantitative_reasoning'
  | 'situational_judgement'
  | 'generic'

export const AI_GENERATION_SYSTEM_PROMPT = `You generate UCAT ANZ tutor-review drafts that should need minimal editing before approval.

Return JSON only. Do not include markdown or prose outside the JSON object.
Write in the style of official UCAT practice material: concise stems, ordinary real-world contexts, precise wording, plausible distractors, and no teaching-style scaffolding.
Every generated question must include a concise, student-facing question-level answerExplanation.
Explanations must justify why the correct answer is correct and why the main distractors fail.
When writing answer explanations, act as a tutor teaching the student how to solve the question, not as a question writer justifying an answer key.
Explanations must teach an efficient timed-test method, not merely report the result. Name or demonstrate a useful representation such as a table, ordered list, diagram, equation, elimination grid, or annotated evidence when it genuinely helps. If the explanation relies on a table, grid, diagram, or list, include that representation as structured content blocks inside the answerExplanation.
Make explanations easy to scan using short paragraphs, list blocks, or table blocks where relevant. Include useful shortcuts, traps to watch for, and for genuinely high time-burden questions advise the student to recognise the burden, skip, and return later if time permits.
Do not copy sample stems, distinctive premises, data relationships, names, or near-exact wording. Use examples only to calibrate style, length, difficulty, and answer format.
Avoid generic AI prose and punctuation habits. Do not use em dashes, double hyphens, canned headings, false starts, self-correction, or phrases such as "it is important to note".
Avoid image-dependent questions unless the selected category warrants a deterministic table, chart, diagram, or visual spec that contains examinable data.`

const SECTION_PROMPTS: Record<AiGenerationSectionKey, string> = {
  verbal_reasoning: `Verbal Reasoning rules:
- Each stem must be a passage of 2-6 paragraphs, written like a compact factual article or commentary excerpt.
- Match passage length to time burden: usually 250-350 words for low, 350-450 for medium, and 450-550 for high.
- Generate exactly 4 questions per stem.
- Keep the passage self-contained and neutral. Do not require outside knowledge, specialist facts, or moral judgement.
- Use dense but readable prose with enough detail for inference, author attitude, purpose, exact wording, and not-given distinctions.
- A stem must use one answer mode consistently:
  - True, False, Can't Tell category: every question has exactly 3 options, in this order: True, False, Can't Tell.
  - Reading Comprehension category: every question has exactly 4 options.
- Use only one correct answer per question.
- Questions must be answerable from the passage alone. Wrong options should be tempting because they overstate, reverse, confuse scope, import outside knowledge, or match only part of the passage.
- Do not write comprehension questions that can be answered by keyword matching alone.
- Include a question-level answerExplanation for every question, explaining the textual evidence for the correct answer and the flaw in the strongest distractor.
- In every answerExplanation, identify the passage paragraph number whenever quoting, paraphrasing, or relying on textual evidence, e.g. "Paragraph 2 states..." or "This is supported by paragraph 4."`,
  decision_making: `Decision Making rules:
- Candidate must fit one of these categories: Syllogisms, Recognising Assumptions, Venn Diagrams, Probabilistic and Statistical Reasoning, Logical Puzzles.
- Generate exactly 1 question per stem.
- For multiple-choice questions, include 4-5 options and exactly one correct answer.
- For syllogism questions, each option is a statement and isAnswer means Yes/No truth value.
- Syllogisms question text must be exactly: Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.
- Recognising Assumptions question text must be exactly: Select the strongest argument from the statements below.
- Syllogisms must have exactly five statements and per-option explanations.
- Keep standalone stems compact. Use precise conditions, dates, quantities, set relationships, rankings, eligibility rules, or short public-policy prompts.
- Correct answers must follow from the supplied information, not real-world plausibility. Distractors should fail by adding assumptions, reversing conditions, confusing necessary and sufficient conditions, or ignoring constraints.
- Argument items should use a balanced public question and four arguments. The strongest option should be directly relevant, evidence-based, and decisive; weaker options should be emotive, tangential, unsupported, or too narrow.
- Include a question-level answerExplanation for non-syllogism questions.
- Teach the fastest appropriate method: use a compact table or elimination grid for assignments, a slot diagram for ordering/seating, set notation or a Venn diagram for sets, a probability tree or complement method for probability, and a necessary-versus-sufficient rule check for conditional logic.
- Explanations should first show the efficient setup, then apply the decisive rule or calculation, then briefly identify why each distractor fails. Do not include hidden deliberation or narrate trial-and-error.`,
  quantitative_reasoning: `Quantitative Reasoning rules:
- Generate between 1 and 4 questions per stem, using the same data source where multiple questions are present.
- Include exactly 5 options and exactly one correct answer per question.
- Use realistic numbers, units, ratios, percentages, currencies, dates, times, distances, rates, prices, or summary statistics.
- Use structured tables and deterministic visual specs where useful; do not rely on freeform image descriptions.
- Keep the data source compact but information-rich. Official-style QR often asks for one or two calculation steps plus interpretation, not long algebra.
- Make distractors numerically plausible: common rounding choices, inverse ratios, wrong denominator, percentage point vs percent change, unit conversion slips, transposed table entries, or reading the wrong series.
- Include enough information in the stem for all calculations, including any formula or reference definition needed.
- Include a question-level answerExplanation for every question with auditable working and units.`,
  situational_judgement: `Situational Judgement rules:
- Generate realistic professional/ethical scenarios.
- Generate exactly 4 questions per stem.
- Use either How Important or How Appropriate for all questions in the stem, never both.
- How Important options exactly: Very important; Important; Of minor importance; Not important at all.
- How Appropriate options exactly: A very appropriate thing to do; Appropriate, but not ideal; Inappropriate, but not awful; A very inappropriate thing to do.
- Include exactly one best answer per question.
- Scenario context should be brief and concrete: medical student, junior doctor, patient, colleague, tutor, supervisor, ward, clinic, placement, confidentiality, consent, safety, honesty, respect, teamwork, or escalation.
- Each question should evaluate one consideration or action, not a bundle of several actions.
- The best answer should reflect patient safety, professional integrity, scope of practice, confidentiality, seeking help, and respectful communication.
- Include a question-level answerExplanation for every question, acknowledging plausible judgement nuance where relevant.`,
  generic: `Generic UCAT rules:
- Generate coherent UCAT-style stems with linked questions.
- Include 4-5 options and exactly one correct answer for multiple-choice questions.
- Include a question-level answerExplanation for every question.`,
}

export function sectionNameToAiGenerationKey(sectionName: string | null | undefined): AiGenerationSectionKey {
  if (sectionName === 'Verbal Reasoning') return 'verbal_reasoning'
  if (sectionName === 'Decision Making') return 'decision_making'
  if (sectionName === 'Quantitative Reasoning') return 'quantitative_reasoning'
  if (sectionName === 'Situational Judgement') return 'situational_judgement'
  return 'generic'
}

export function getAiGenerationSectionPrompt(section: AiGenerationSectionKey): string {
  return SECTION_PROMPTS[section]
}

export function buildAiGenerationUserPrompt(input: {
  sectionName: string
  sectionPrompt: string
  categoryName: string | null
  stemCount: number
  examples: Array<Record<string, unknown>>
}): string {
  return JSON.stringify(
    {
      task: 'Generate UCAT question stems from samples',
      section: input.sectionName,
      category: input.categoryName,
      stemCount: input.stemCount,
      sectionRules: input.sectionPrompt,
      requirements: [
        'Return exactly stemCount stems.',
        'Every question must include non-empty answerExplanation.',
        'Use question-level answerExplanation; option answerExplanation may be null.',
        'Every multiple_choice question must have exactly one option with isAnswer=true.',
        'Do not generate image-dependent content.',
      ],
      examples: input.examples,
      outputShape: {
        stems: [
          {
            stemText: 'string',
            questions: [
              {
                questionText: 'string',
                questionType: 'multiple_choice|syllogism',
                answerExplanation: 'required non-empty string',
                options: [
                  {
                    answerText: 'string',
                    answerExplanation: null,
                    isAnswer: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    null,
    2
  )
}

export type AiGenerationPromptLayer = {
  scopeType: 'section' | 'stem_category' | 'question_tag'
  name: string
  promptText: string
  version: number
}

export type AiGenerationBrief = {
  sectionName: string
  categoryName: string | null
  availableCategories?: Array<{ id: string; name: string }>
  stemCount: number
  difficultyTarget: 'easy' | 'medium' | 'hard' | 'mixed'
  timeBurdenTarget: 'low' | 'medium' | 'high' | 'mixed'
  targetTags: Array<{ id: string; name: string }>
  runInstructions?: string | null
  examples: Array<Record<string, unknown>>
  promptLayers: AiGenerationPromptLayer[]
}

function normalizedPromptLayerText(layer: AiGenerationPromptLayer): string {
  if (layer.scopeType !== 'stem_category' || layer.name !== 'Venn Diagrams') return layer.promptText
  return layer.promptText
    .replace(/spec\.labels/gu, 'spec.regionLabels')
    .replace(/spec\.shapes and spec\.regionLabels/gu, 'spec.shapes and spec.regionLabels')
    .replace(
      /Use visualType "set_diagram" or shape-based "venn_diagram" with spec\.shapes and spec\.regionLabels\./u,
      'Use visualType "set_diagram" or shape-based "venn_diagram" with spec.shapes and spec.regionLabels. Use shapes[].label only for set names; use regionLabels only for numeric region values.'
    )
}

function layeredInstructions(input: Pick<AiGenerationBrief, 'promptLayers'>): string[] {
  return input.promptLayers.map((layer) => `${layer.scopeType}:${layer.name} v${layer.version}\n${normalizedPromptLayerText(layer)}`)
}

export function buildPlanningPrompt(input: AiGenerationBrief): string {
  return JSON.stringify(
    {
      task: 'Plan diverse UCAT generation candidates before writing content',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        availableCategories: input.availableCategories ?? [],
        requestedStemCount: input.stemCount,
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
        runInstructions: input.runInstructions,
      },
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      requirements: [
        'Create exactly requestedStemCount plan rows.',
        'If category is selected, treat it as targeted practice and keep every plan row inside that category.',
        'If category is null, do not spread evenly across availableCategories. Choose a natural UCAT-style mix, using source examples and section realism over coverage.',
        'For mixed difficulty or mixed time burden, do not force an even easy/medium/hard or low/medium/high distribution. Use natural variation and estimate each question after writing.',
        'For QR, category is organisational metadata unless the tutor explicitly selected a category. In default generation, do not choose the QR category before choosing the source; write a realistic source first, then classify it.',
        "For VR, each stem must still be either Reading Comprehension or True, False, Can't Tell, but vary passage source style, traps, evidence distribution, and question mix within the category.",
        'For DM, each stem must fit one DM category, but vary scenario domain, reasoning structure, diagrams, constraints, wording, and distractor logic within the category.',
        'For SJ, each stem must be How Important or How Appropriate, but vary professional context, ethical principle, stakeholder, and judgement nuance within that mode.',
        'Vary scenario domains, question archetypes, distractor plans, wording patterns, names, data relationships, and source layouts.',
        'Avoid planning disguised clones of source examples.',
      ],
      outputShape: {
        plans: [
          {
            stemIndex: 0,
            scenarioDomain: 'string',
            questionArchetype: 'string',
            categoryName: input.categoryName ?? 'exact available category name',
            distractorPlan: 'string',
            difficultyTarget: 'easy|medium|hard|mixed',
            timeBurdenTarget: 'low|medium|high|mixed',
            notes: 'string',
          },
        ],
      },
    },
    null,
    2
  )
}

export function buildWriterPrompt(input: AiGenerationBrief & { plan: unknown }): string {
  return JSON.stringify(
    {
      task: 'Write UCAT generation candidates from the plan',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        availableCategories: input.availableCategories ?? [],
        requestedStemCount: input.stemCount,
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
        runInstructions: input.runInstructions,
      },
      plan: input.plan,
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      sourceExamplesForCalibrationOnly: input.examples,
      contentBlockContract: [
        'stemText, questionText, answerText, and explanations may be strings or arrays of generated content blocks.',
        'Content blocks: paragraph {type,text}, list {type,ordered:boolean,items:string[]}, table {type,caption,columns,rows}, visual {type,visualType,title,altText,spec}.',
        'Inside text fields, **text** is converted to bold rich text. Use it sparingly in questionText for decisive command words only.',
        'Use table blocks for data tables.',
        'Use visual blocks only for warranted QR/DM visual categories and provide exact structured data in spec. Do not write freeform image descriptions.',
        'Structured visual visualType options are vega_lite_chart, set_diagram, and shape-based venn_diagram only.',
        'QR visualType: vega_lite_chart only. spec must be a complete Vega-Lite JSON spec with inline data.values or datasets. Do not use external urls. Do not use bar_chart, stacked_bar_chart, line_chart, scatter_plot, histogram, pie_chart, route_map, schematic_map, layout_grid, or timetable.',
        'For vega_lite_chart, use the freedom of Vega-Lite to create realistic UCAT source visuals: horizontal or vertical bars, grouped bars, stacked bars, line charts, multi-line charts, scatter plots, histograms, dot/strip plots, pie/donut charts only when suitable, layered rules/text annotations, small multiples, facets, hconcat/vconcat panels, independent scales, maps/route diagrams, floor-plan style layouts, timetable-style grids, tables plus mini charts where appropriate, and unusual but readable exam-style layouts.',
        'Every vega_lite_chart must be black and white only. Differentiate series using greyscale, strokeDash, opacity, point shapes, hatching-like repeated marks where possible, text labels, or faceting. Do not use coloured palettes.',
        'Avoid generic chart templates. Across a generated batch, no two QR charts should have the same chart structure with only labels or numbers changed. Vary mark types, orientation, axis treatment, label placement, legend placement, panel layout, annotation style, data density, and the kind of interpretation required.',
        'Use clear axes, units, scales, legends, and enough labelled data to support realistic QR interpretation. The chart must contain all values needed to solve the questions; do not rely on prose for hidden chart values.',
        'DM Venn/set visualTypes: venn_diagram and set_diagram. These can appear in stemText, questionText, answerText, or answerExplanation. Use answerText visual blocks when answer options are diagrams.',
        'For DM Venn Diagrams, use shape-based set_diagram or venn_diagram specs only: {shapes:[{id?:string,shape:"circle"|"ellipse"|"rect"|"triangle"|"diamond"|"pentagon"|"hexagon",label?:string,cx?:number,cy?:number,r?:number,rx?:number,ry?:number,x?:number,y?:number,width?:number,height?:number}], regionLabels:[{text:string|number,region?:string,include?:string[],exclude?:string[],x?:number,y?:number,bold?:boolean,fontSize?:number}]}.',
        'Use shapes[].label only for set names. Use regionLabels only for examinable region values such as 0, 3, 12, or 45. Do not put set names such as R/S/T or Biology/Chemistry in regionLabels.',
        'For every numeric Venn/set regionLabel, include a semantic set-region expression using either region:"A&B&not C" style or include/exclude arrays matching shapes[].id or shapes[].label. Do not rely on raw x/y coordinates for numeric values; the renderer places numbers from the semantic region.',
        'Do not output two numeric labels with the same set-region expression unless the answer option is intentionally showing an invalid diagram. Do not leave a required numeric region unlabeled when the question depends on that region.',
        'For mixed-shape set diagrams, labels may be shown by a single visual legend. Do not also write a sentence in the stem that repeats the same shape-to-set mapping unless it contains extra examinable information.',
        'If two or more sets use the same shape type, provide clear shape labels or labelX/labelY positions on the diagram instead of relying on a legend.',
        'Keep visual altText short and accessibility-oriented only. Do not write a visible caption or prose description after the visual unless it contains extra examinable information.',
        'Do not use the old coloured three-overlapping-circle Venn template for DM Venn Diagrams. If you need a conventional three-circle answer option, still encode it as shapes with three circle entries, monochrome strokes, and no coloured fills.',
        'Official-style DM set diagrams should usually be monochrome or very lightly filled, with region numbers placed clearly inside regions and a separate legend for set names. Do not place numbers on shape outlines, intersections, or ambiguous boundary areas. Use overlapping/nested shapes where useful.',
        'For QR Maps and Diagrams, use vega_lite_chart. Encode routes, paths, spatial layouts, floor plans, seating maps, distance networks, and geometric diagrams as layered Vega-Lite specs using inline coordinate data, rule/line marks, point marks, text labels, rects, and annotations as needed.',
        'For QR Timetables and Calendars, use table blocks for ordinary data tables or vega_lite_chart for timetable-style visual density. Encode timetable-style visuals with layered rect/text marks and inline datasets; do not use a timetable visualType.',
        'Do not output ProseMirror JSON.',
      ],
      requirements: [
        'Return JSON only.',
        'Return candidates for the full plan.',
        'If the brief category is selected, set each stem categoryName exactly to that selected category.',
        'If the brief category is null, choose categoryName from availableCategories only after deciding the source and questions. Treat categoryName as metadata/classification, not as a template to satisfy.',
        'If the plan includes a categoryName for VR, DM, or SJ, use that exact available category. For default QR plans, categoryName may be absent from the plan so the source can be generated before classification.',
        'If difficultyTarget or timeBurdenTarget is mixed, generate natural official-style variation and then set estimatedDifficulty/estimatedTimeBurdenSeconds honestly; do not manufacture an even distribution.',
        'If difficultyTarget or timeBurdenTarget is easy/medium/hard or low/medium/high, treat it as a broad tutor-requested target, not an exact promise.',
        ...(sectionNameToAiGenerationKey(input.sectionName) === 'verbal_reasoning'
          ? [
              'Return stemText as 2-6 paragraph content blocks, not one unbroken string.',
              'Write passages with a slightly higher density of named entities, titles, dates, years, quantities, percentages, study names, places, organisations, species names, quoted terms, or other scan-friendly anchors, similar to a concise Wikipedia-style article. Do not make the passage artificially list-like.',
              'Follow the planned passage length/time burden and test four distinct reading skills, but avoid making all four questions global synthesis questions.',
              'Include at least two questions per VR stem that can be answered efficiently by scanning for a proper noun, number, date, quoted term, or distinctive phrase, then reading the surrounding sentence/paragraph. Use at most one broad whole-passage question such as main purpose, best overall support, or author attitude unless the requested time burden is high.',
              "For True, False, Can't Tell, questionText must contain only the statement being assessed. Never state or hint whether it is True, False, or Can't Tell in questionText.",
              'In answerExplanation, cite the relevant passage paragraph number whenever quoting, paraphrasing, or relying on textual evidence, using labels such as Paragraph 1 or Paragraph 3.',
            ]
          : []),
        ...(input.categoryName === 'Logical Puzzles'
          ? [
              'Follow the planned puzzleArchetype, scenarioDomain, and questionFocus; do not substitute an ages/race ranking puzzle unless explicitly planned.',
              'Before returning, verify the keyed option against every arrangement satisfying the constraints and ensure no other option is also valid.',
              'The stem must contain only the scenario and constraints; put the command/question only in questionText.',
              'Write the answerExplanation as a concise teaching solution: recommend and demonstrate a suitable table, ordered list, slot diagram, or elimination grid; then give the final proof and explain each distractor.',
              'Do not include exploratory reasoning, self-correction, false starts, or phrases such as wait, re-read, we missed, actually, let us reconsider, or both orders are possible.',
              'Do not create trivial options that directly repeat one stated rule. Each distractor should require applying at least one constraint and should fail for a specific reason.',
            ]
          : []),
        ...(input.categoryName === 'Venn Diagrams'
          ? [
              'Include deterministic Venn/set visuals using the shape-based set_diagram/venn_diagram contract. Follow the planned vennVisualFormat exactly.',
              'Do not generate the legacy three coloured overlapping circles. Three-circle diagrams are allowed only as monochrome boxed answer options when the planned format asks for answer option diagrams.',
              'Vary Venn formats in official style: two-set, three-set, four-shape diagrams, nested ellipses, overlapping ellipses, rectangles with circles, triangles/pentagons/hexagons/diamonds/circles, unlabeled or lightly labeled regions, and answer options that are themselves diagrams when appropriate.',
              'When answer options are diagrams, each option answerText must be a visual block. Use the same canvas scale and shape layout across options, changing only the region values or membership relationship needed for the option.',
              'Every displayed region value or diagram relationship must be sufficient to solve the question. Include at least three numeric regionLabels across the Venn/set visual(s). Place each numeric regionLabel comfortably inside a region, not between shapes or on a boundary. Use monochrome or very lightly filled shapes unless colour is part of the data.',
            ]
          : []),
        ...(input.categoryName === 'Recognising Assumptions'
          ? [
              'Construct exactly four arguments with only one unambiguously strongest option. The strongest must directly answer the policy question, cite relevant evidence or a testable fact, and explain a decisive mechanism.',
              'Give each distractor exactly one clear weakness: emotive assertion, tangential concern, unsupported prediction, anecdote, or scope too narrow to answer the policy question. Do not include a second evidence-based argument that directly answers the question from the opposite side.',
              'In the explanation, name the strength criteria first, apply them consistently to all four options, and do not dismiss a directly relevant argument merely because it supports the opposite conclusion.',
            ]
          : []),
        ...(input.categoryName === 'Data Tables' || input.categoryName === 'Timetables and Calendars'
          ? ['Include at least one table content block or vega_lite_chart containing the examinable data. Prefer vega_lite_chart for schedule grids with many times, route columns, days, or availability windows that should be visually dense.']
          : []),
        ...(input.categoryName === 'Graphs and Charts'
          ? [
              'Include at least one vega_lite_chart visual block containing the examinable data.',
              'Choose a genuinely suitable Vega-Lite composition for the data rather than defaulting to bars. Use layered, faceted, concatenated, annotated, horizontal, or multi-panel designs when they make the source more like real UCAT QR.',
              'Keep the chart black and white only. Use greyscale, dash patterns, point shapes, opacity, labels, or panel separation to distinguish data.',
              'Make the chart information-rich enough that interpreting the data source is part of the question, not just reading one obvious bar.',
            ]
          : []),
        ...(input.categoryName === 'Maps and Diagrams'
          ? [
              'Include at least one vega_lite_chart visual block containing the examinable map or diagram data.',
              'Use layered Vega-Lite marks for the diagram: lines or rules for paths/edges, points or shapes for locations, text labels for place names and distances, and rects or light greyscale fills for floor-plan regions where appropriate.',
              'Do not use route_map, schematic_map, layout_grid, or timetable. The diagram should still be black and white only, with any differentiation handled through greyscale, strokeDash, shape, opacity, or labels.',
              'Vary map and diagram structure across generated stems: path networks, transit-style maps, floor plans, coordinate layouts, route-choice diagrams, scale diagrams, and multi-panel diagrams are all acceptable when mathematically coherent.',
            ]
          : []),
        ...(input.categoryName === 'Mixed Data Sources'
          ? ['Include at least two examinable structured sources, including a table plus a vega_lite_chart when a visual source is needed. Multiple visual blocks in one stem are allowed when the information is genuinely mixed. For map, diagram, timetable, or chart data inside Mixed Data Sources, encode it as layered vega_lite_chart rather than a legacy visual type.']
          : []),
        ...(input.categoryName === 'Text-Only Scenarios'
          ? ['Keep the stem text-only. Do not include table or visual content blocks.']
          : []),
        'In questionText, wrap decisive logical qualifiers such as MUST, CANNOT, COULD, EXCEPT, NOT, ALWAYS, LEAST, MOST, TRUE, and FALSE in **bold markers** and capitalize them. Do not bold ordinary words.',
        'Follow the plan correctAnswerPattern exactly so correct answers are not concentrated in one option position.',
        'Do not copy selected source examples, scenario premises, distinctive data relationships, or near-exact wording.',
        'Every multiple_choice question must have exactly one isAnswer=true option and a question-level explanation.',
        'Every syllogism option must have answerExplanation explaining why the answer is Yes or No.',
        'Answer explanations must act as a tutor: show the efficient setup, include a table/list/diagram content block when that representation is part of the method, explain why the correct answer is correct, and explain why every distractor is wrong.',
        'Use short paragraphs, list blocks, or table blocks in explanations so they are easy to read. Include useful shortcuts and common traps where relevant.',
        'For questions with high estimated time burden, include a brief timed-test note telling the student how to recognise the burden and consider skipping then returning later if time permits.',
        'Use clean human editorial prose. Do not use em dashes, double hyphens, canned AI transitions, or self-referential commentary.',
      ],
      outputShape: {
        stems: [
          {
            stemText: 'string or GeneratedContentBlock[]',
            categoryName: input.categoryName ?? 'exact available category name',
            difficultyTarget: 'easy|medium|hard|mixed',
            timeBurdenTarget: 'low|medium|high|mixed',
            warnings: [],
            questions: [
              {
                questionText: 'string or GeneratedContentBlock[]',
                questionType: 'multiple_choice|syllogism',
                answerExplanation: 'string or GeneratedContentBlock[] or null',
                difficultyTarget: 'easy|medium|hard|mixed',
                timeBurdenTarget: 'low|medium|high|mixed',
                estimatedDifficulty: 0.5,
                estimatedTimeBurdenSeconds: 90,
                tagIds: [],
                options: [
                  {
                    answerText: 'string or GeneratedContentBlock[]',
                    answerExplanation: 'string or GeneratedContentBlock[] or null',
                    isAnswer: true,
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    null
  )
}

export function buildCriticPrompt(input: AiGenerationBrief & { candidates: unknown }): string {
  return JSON.stringify(
    {
      task: 'Independently solve and critique UCAT generation candidates',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        availableCategories: input.availableCategories ?? [],
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
      },
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      sourceExamplesForSimilarityCheck: input.examples,
      candidates: input.candidates,
      requirements: [
        'Mark objective answer or explanation errors as blocking with high confidence.',
        'For Situational Judgement and ambiguous Verbal Reasoning, warn when multiple answers are plausible unless the item is clearly invalid.',
        'Warn for weak distractors, thin explanations, difficulty/time-burden target mismatch, or low UCAT-likeness.',
        'Block disguised clones of source examples. Do not block broad topic, archetype, answer pattern, ordinary names, or generic table/chart dimensions.',
      ],
      outputShape: {
        issues: [
          {
            severity: 'blocking|warning',
            code: 'string',
            message: 'string',
            stemIndex: 0,
            questionIndex: 0,
            confidence: 0.75,
          },
        ],
        scores: {
          ucatLikeness: 0.9,
          answerConfidence: 0.9,
          explanationQuality: 0.9,
        },
      },
    },
    null,
    2
  )
}

export function buildRewriterPrompt(input: AiGenerationBrief & { candidate: unknown; issues: unknown }): string {
  return JSON.stringify(
    {
      task: 'Rewrite a salvageable UCAT generation candidate once',
      brief: {
        section: input.sectionName,
        category: input.categoryName,
        difficultyTarget: input.difficultyTarget,
        timeBurdenTarget: input.timeBurdenTarget,
        targetTags: input.targetTags,
      },
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      candidate: input.candidate,
      issues: input.issues,
      requirements: [
        'Fix the listed issues without changing the selected section/category.',
        'Preserve UCAT style and answer validity.',
        'Return exactly one rewritten candidate in the same stems array shape.',
      ],
      outputShape: {
        stems: [
          {
            stemText: 'string or GeneratedContentBlock[]',
            categoryName: input.categoryName ?? 'exact available category name',
            questions: [],
          },
        ],
      },
    },
    null,
    2
  )
}
