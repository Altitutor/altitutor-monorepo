import { buildUcatExplanationPolicy } from '@/features/ucat/questions/lib/ai-generation/explanation-rubric'

export type AiGenerationSectionKey =
  | 'verbal_reasoning'
  | 'decision_making'
  | 'quantitative_reasoning'
  | 'situational_judgement'
  | 'generic'

export const AI_GENERATION_SYSTEM_PROMPT = `You generate UCAT ANZ tutor-review drafts that should need minimal editing before approval.

Return JSON only. Do not include markdown or prose outside the JSON object.
Write in Australian English and in the style of official UCAT practice material: concise stems, ordinary real-world contexts, precise wording, plausible distractors, and no teaching-style scaffolding.
Follow the explanationPolicy supplied in the user payload for all student-facing explanations. It is the canonical teaching and presentation standard.
Do not copy sample stems, distinctive premises, data relationships, names, or near-exact wording. Use examples only to calibrate style, length, difficulty, and answer format.
Avoid generic AI prose and punctuation habits. Do not use em dashes, double hyphens, canned headings, false starts, self-correction, or phrases such as "it is important to note".`

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
- Passage paragraphs are unnumbered prose. Never prefix passage text with labels or headings such as "Paragraph 1", "Paragraph 2", or "Paragraph 3". Paragraph numbers are positional references used only in answer explanations.
- Include a question-level answerExplanation for every question, explaining the textual evidence for the correct answer and the flaw in the strongest distractor.
- In every answerExplanation, identify the passage paragraph number whenever quoting, paraphrasing, or relying on textual evidence, e.g. "Paragraph 2 states..." or "This is supported by paragraph 4."`,
  decision_making: `Decision Making rules:
- Candidate must fit one of these categories: Syllogisms, Interpreting Information and Drawing Conclusions, Recognising Assumptions, Venn Diagrams, Probabilistic and Statistical Reasoning, Logical Puzzles.
- Generate exactly 1 question per stem.
- For multiple-choice questions, include 4-5 options and exactly one correct answer.
- For binary-placement questions, each option is a statement and answerKeyValue is yes or no.
- Binary-placement question text must be exactly: Place 'Yes' if the conclusion does follow. Place 'No' if the conclusion does not follow.
- Recognising Assumptions question text must be exactly: Select the strongest argument from the statements below.
- Binary-placement questions must have exactly five statements and per-option explanations.
- Keep standalone stems compact. Use precise conditions, dates, quantities, set relationships, rankings, eligibility rules, or short public-policy prompts.
- Correct answers must follow from the supplied information, not real-world plausibility. Distractors should fail by adding assumptions, reversing conditions, confusing necessary and sufficient conditions, or ignoring constraints.
- Argument items should use a balanced public question and four arguments. The strongest option should be directly relevant, evidence-based, and decisive; weaker options should be emotive, tangential, unsupported, or too narrow.
- Include a question-level answerExplanation for multiple-choice questions.
- Teach the fastest appropriate method: use a compact table or elimination grid for assignments, a slot diagram for ordering/seating, set notation or a Venn diagram for sets, a probability tree or complement method for probability, and a necessary-versus-sufficient rule check for conditional logic.
- Explanations should first show the efficient setup, then apply the decisive rule or calculation, then briefly identify why each distractor fails. Do not include hidden deliberation or narrate trial-and-error.`,
  quantitative_reasoning: `Quantitative Reasoning rules:
- Generate one or more questions per stem, using the same data source where multiple questions are present. Do not impose an arbitrary maximum question count.
- Include exactly 5 options and exactly one correct answer per question.
- Use realistic numbers, units, ratios, percentages, currencies, dates, times, distances, rates, prices, or summary statistics.
- Use structured tables and deterministic visual specs where useful; do not rely on freeform image descriptions.
- Keep the data source compact but information-rich. Use however many purposeful calculation and interpretation steps the question naturally requires; do not impose a fixed number of steps.
- Make distractors numerically plausible: common rounding choices, inverse ratios, wrong denominator, percentage point vs percent change, unit conversion slips, transposed table entries, or reading the wrong series.
- Include enough information in the stem for all calculations, including any formula or reference definition needed.
- Include a question-level answerExplanation for every question with auditable working and units.`,
  situational_judgement: `Situational Judgement rules:
- Generate realistic professional/ethical scenarios.
- Use How Important, How Appropriate, or Most/Least Appropriate.
- How Important and How Appropriate stems generate exactly 4 questions, each with a multiple-choice rating response.
- How Important options exactly: Very important; Important; Of minor importance; Not important at all.
- How Appropriate options exactly: A very appropriate thing to do; Appropriate, but not ideal; Inappropriate, but not awful; A very inappropriate thing to do.
- Most/Least Appropriate stems generate exactly 1 drag-and-drop question with three actions. Mark one action most and one action least.
- For Most/Least Appropriate, vary the on-screen order of the three actions across stems. Do not default to most-keyed first, unkeyed second, and least-keyed third.
- Include exactly one best answer per rating question.
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
      explanationPolicy: buildUcatExplanationPolicy({ sectionName: input.sectionName }),
      requirements: [
        'Return exactly stemCount stems.',
        'Multiple-choice questions: answerExplanation must be non-empty and every option answerExplanation must be null.',
        'Binary-placement questions: answerExplanation must be null and every option answerExplanation must be non-empty.',
        'Every single_choice or situational_judgement_rating question must have exactly one option with answerKeyValue="correct".',
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
                responseType: 'multiple_choice|drag_and_drop',
                answerScheme: 'single_choice|situational_judgement_rating|decision_making_binary_placement|situational_judgement_most_least',
                answerExplanation: 'non-empty for multiple_choice; null for drag_and_drop',
                options: [
                  {
                    answerText: 'string',
                    answerExplanation: 'null for multiple_choice; non-empty for drag_and_drop',
                    answerKeyValue: 'correct|yes|no|most|least|null',
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

export type AiGenerationTag = {
  id: string
  name: string
  path: string
  description: string | null
  parentId: string | null
}

export type AiGenerationBrief = {
  sectionName: string
  categoryName: string | null
  availableCategories?: Array<{ id: string; name: string }>
  stemCount: number
  difficultyTarget: 'easy' | 'medium' | 'hard' | 'mixed'
  timeBurdenTarget: 'low' | 'medium' | 'high' | 'mixed'
  targetTags: Array<{ id: string; name: string }>
  availableTags: AiGenerationTag[]
  runInstructions?: string | null
  examples: Array<Record<string, unknown>>
  presentationReference?: {
    id: string | null
    categoryName: string | null
    stemText: unknown
  } | null
  vennStructureReference?: {
    id: string | null
    stemText: unknown
    questions: unknown
    diagramLocation: 'stem' | 'answer_options'
  } | null
  sourceImagesForCalibration?: Array<Record<string, unknown>>
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
        availableTags: input.availableTags,
        runInstructions: input.runInstructions,
      },
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      layeredInstructions: layeredInstructions(input),
      requirements: [
        'Create exactly requestedStemCount plan rows.',
        'If category is selected, treat it as targeted practice and keep every plan row inside that category.',
        'If category is null, do not spread evenly across availableCategories. Choose a natural UCAT-style mix, using source examples and section realism over coverage.',
        'For mixed difficulty or mixed time burden, do not force an even easy/medium/hard or low/medium/high distribution. Use natural variation and estimate each question after writing.',
        'For QR, category is organisational metadata unless the tutor explicitly selected a category. In default generation, use categoryName only as a soft source-format intent for retrieving and calibrating examples; write a realistic source first, then classify the final stem honestly.',
        "For VR, each stem must still be either Reading Comprehension or True, False, Can't Tell, but vary passage source style, traps, evidence distribution, and question mix within the category.",
        'For DM, each stem must fit one DM category, but vary scenario domain, reasoning structure, diagrams, constraints, wording, and distractor logic within the category.',
        'For SJ, each stem must be How Important, How Appropriate, or Most/Least Appropriate, but vary professional context, ethical principle, stakeholder, and judgement nuance within that item type.',
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

function contentBlockContract(sectionName: string): string[] {
  const base = [
    'stemText, questionText, answerText, and explanations may be strings or arrays of generated content blocks.',
    'Content blocks: paragraph {type,text}, list {type,ordered:boolean,items:string[]}, table {type,caption,columns,rows}, visual {type,visualType,title,altText,spec}.',
    'Inside text fields, **text** is converted to bold rich text. Use it sparingly in questionText for decisive command words only.',
    'Use table blocks for examinable tabular data and visual blocks only when the visual itself is part of the reasoning.',
    'Do not write freeform image descriptions or ProseMirror JSON.',
  ]

  const section = sectionNameToAiGenerationKey(sectionName)
  if (section === 'quantitative_reasoning') {
    return [
      ...base,
      'QR visuals use visualType vega_lite_chart only. Provide a complete Vega-Lite JSON spec with inline data.values or datasets and no external URLs.',
      'When a source visual is used, its data, labels, units, axes, legends, and layout must be readable and sufficient to answer every question.',
      'Vega-Lite visuals must be black and white or greyscale. Use labels, dash patterns, shapes, opacity, or panel separation when series need differentiating.',
    ]
  }

  if (section === 'decision_making') {
    return [
      ...base,
      'DM Venn/set visuals use visualType venn_diagram or set_diagram only. Use shape-based specs with labelled shapes and clearly placed region values.',
      'Supported set shapes are circle, ellipse, rect, triangle, diamond, pentagon, hexagon, cross, and polygon. Polygon shapes use points as [x,y] pairs or {x,y} objects. Shapes may use rotation in degrees.',
      'Use shapes[].label only for set names and regionLabels only for examinable values. For simple circle Venns, numeric regionLabels may use semantic region expressions or include/exclude arrays matching a shape id or label.',
      'For every examinable Venn/set numeric label, provide semantic membership metadata using region or include/exclude arrays. Place values inside their exact region, not on a boundary.',
      'Do not put two numeric values in the same semantic set region unless an answer option is intentionally invalid. Do not leave a required region unlabeled.',
      'For mixed-shape diagrams, keep coordinate values on one coherent scale and use labels or a legend to identify each set. Do not repeat the legend in stem prose unless it adds examinable information.',
      'Set names must use the scenario terminology, not placeholder letters such as A-E. If every set has a different shape type, use a legend with one unique shape per set. If any shape type repeats, label each shape directly and position each label so its shape is unambiguous.',
      'Identify every represented set. Never label only some of the shapes. Make every examinable overlap region broad enough to hold its value clearly; avoid slivers, tangencies, and nearly coincident borders.',
      'Keep Venn/set diagrams monochrome or lightly filled. Do not use the legacy coloured three-overlapping-circle template.',
    ]
  }

  return base
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
        availableQuestionTags: input.availableTags,
        runInstructions: input.runInstructions,
      },
      plan: input.plan,
      sectionRules: getAiGenerationSectionPrompt(sectionNameToAiGenerationKey(input.sectionName)),
      explanationPolicy: buildUcatExplanationPolicy({ sectionName: input.sectionName }),
      layeredInstructions: layeredInstructions(input),
      sourceExamplesForCalibrationOnly: input.examples,
      presentationReferenceForSourceFormat: input.presentationReference ?? null,
      vennReferenceForQuestionStructure: input.vennStructureReference ?? null,
      sourceImagesForCalibrationOnly: input.sourceImagesForCalibration ?? [],
      contentBlockContract: contentBlockContract(input.sectionName),
      requirements: [
        'Return JSON only.',
        'Return candidates for the full plan.',
        ...(input.sourceImagesForCalibration?.length
          ? [
              'Some source examples include attached images. Use those images only to understand UCAT visual source conventions such as layout density, chart/diagram style, labels, and how questions depend on visuals.',
              'Do not copy exact numbers, labels, names, premises, or answer logic from any attached source image. Generate a new source with new data relationships.',
            ]
          : []),
        ...(sectionNameToAiGenerationKey(input.sectionName) === 'quantitative_reasoning'
          ? [
              ...(input.presentationReference?.categoryName
                ? [
                    `The designated presentation reference is a real ${input.presentationReference.categoryName} stem. The new stem MUST use that same broad presentation family. Invent a new scenario, data, reasoning, and layout; this is a source-led format target, not a subtype template.`,
                    `Set categoryName exactly to ${JSON.stringify(input.presentationReference.categoryName)} after writing.`,
                  ]
                : [
                    'Treat the presentation forms in the supplied source examples and images as legitimate options for the new stem. Choose the form that best supports the newly invented data and reasoning; do not default to a table when another presentation is more natural. This is guidance, not a format quota or template.',
                  ]),
              input.categoryName
                ? 'The selected QR category is a broad practice constraint. Calibrate from its source examples without forcing a fixed source format or subtype; set categoryName to that selected category after writing.'
                : input.presentationReference?.categoryName
                  ? 'Use the designated reference as the broad presentation target, then classify the completed stem to that same category. Do not add an unrelated second source or turn the category into a subtype template.'
                  : 'For QR, decide the source and questions from the supplied examples first. Only then assign the single best-fit categoryName from availableCategories as organisational metadata. Do not use categoryName to choose the source format.',
            ]
          : [
              'If the brief category is selected, set each stem categoryName exactly to that selected category.',
              'If the brief category is null, choose categoryName from availableCategories only after deciding the source and questions.',
            ]),
        'If the plan includes a categoryName for VR, DM, or SJ, use that exact available category.',
        'If difficultyTarget or timeBurdenTarget is mixed, generate natural official-style variation and then set estimatedDifficulty/estimatedTimeBurdenSeconds honestly; do not manufacture an even distribution.',
        'If difficultyTarget or timeBurdenTarget is easy/medium/hard or low/medium/high, treat it as a broad tutor-requested target, not an exact promise.',
        'estimatedDifficulty is the estimated proportion of the target UCAT candidate cohort who would answer incorrectly on first exposure under realistic section timing and without assistance. Use 0 for easiest and 1 for hardest; higher always means harder.',
        'estimatedTimeBurdenSeconds is the expected active working time, in positive whole seconds, for a candidate from the target UCAT cohort to submit a fully correct answer on first exposure under realistic section timing and without assistance. Estimate each question in its authored position within the stem, including the initial reading or subsequent re-reading normally attributable to that position.',
        'Assign one or more tagIds to every generated question using only exact IDs from availableQuestionTags.',
        'Choose only tags that genuinely describe the reasoning tested by that specific question. Prefer the most specific applicable tags, and do not add tags merely for coverage.',
        'When targetTags are supplied, write questions that genuinely test those requested skills and attach the corresponding IDs where applicable.',
        ...(sectionNameToAiGenerationKey(input.sectionName) === 'verbal_reasoning'
          ? [
              'Return stemText as 2-6 paragraph content blocks, not one unbroken string.',
              'Write passages with a slightly higher density of named entities, titles, dates, years, quantities, percentages, study names, places, organisations, species names, quoted terms, or other scan-friendly anchors, similar to a concise Wikipedia-style article. Do not make the passage artificially list-like.',
              'Follow the planned passage length/time burden and test four distinct reading skills, but avoid making all four questions global synthesis questions.',
              'Where it fits the passage naturally, include questions that can be answered efficiently by locating a distinctive phrase, number, name, or paragraph-level clue. Do not force a fixed number of scan-first questions.',
              "For True, False, Can't Tell, questionText must contain only the statement being assessed. Never state or hint whether it is True, False, or Can't Tell in questionText.",
              'Do not write paragraph numbers, labels, or headings inside stemText. Each passage paragraph must begin directly with its prose; Paragraph 1, Paragraph 2, and similar labels are reserved for answerExplanation references only.',
              'In answerExplanation, cite the relevant passage paragraph number whenever quoting, paraphrasing, or relying on textual evidence, using labels such as Paragraph 1 or Paragraph 3.',
            ]
          : []),
        ...(input.categoryName === 'Logical Puzzles'
          ? [
              'Use the plan as soft realism guidance only. Choose a natural Logical Puzzles structure rather than forcing a fixed puzzle archetype.',
              'Before returning, verify the keyed option against every arrangement satisfying the constraints and ensure no other option is also valid.',
              'The stem must contain only the scenario and constraints; put the command/question only in questionText.',
              'Write the answerExplanation as a concise teaching solution: recommend and demonstrate a suitable table, ordered list, slot diagram, or elimination grid; then give the final proof and explain each distractor.',
              'Do not include exploratory reasoning, self-correction, false starts, or phrases such as wait, re-read, we missed, actually, let us reconsider, or both orders are possible.',
              'Do not create trivial options that directly repeat one stated rule. Each distractor should require applying at least one constraint and should fail for a specific reason.',
            ]
          : []),
        ...(input.categoryName === 'Venn Diagrams'
          ? [
              ...(input.vennStructureReference
                ? [
                    `The designated Venn reference is a real UCAT source and its attached images are the structural target for this call. requiredVennDiagramLocation=${input.vennStructureReference.diagramLocation}. This is a hard output constraint, not a suggestion.`,
                    input.vennStructureReference.diagramLocation === 'answer_options'
                      ? 'Return no Venn/set visual in stemText. Put one set_diagram or venn_diagram visual in every answerText option. Use exactly four diagram options unless the designated source clearly has five. Region labels may be empty when the diagrams test qualitative set relationships rather than numeric values.'
                      : 'Put the examinable Venn/set visual in stemText. Use ordinary text or numeric answer options unless the designated source itself uses diagram answer options.',
                    'Match the number of represented sets and the broad shape family visible in the designated reference. A surrounding universe box does not count as a set. Do not reduce a four-set or five-set reference to three sets, and do not replace a mixed or nested reference with the conventional triangular three-circle layout.',
                    'Calibrate from the reference image family, including nesting, diagram density, and whether a legend is used. Invent a new scenario, set meanings, geometry, region values, logical relationships, question and answer reasoning. Do not trace or clone the exact composition.',
                  ]
                : []),
              'Include one or more examinable shape-based set_diagrams or venn_diagrams. Choose the diagram complexity that makes the reasoning realistic: this may use three or more sets, nested sets, mixed overlapping circles, ellipses, rectangles, triangles, diamonds, pentagons, hexagons, crosses, or explicit polygon shapes. Do not default to the conventional triangular three-circle layout unless the designated real source uses that broad form.',
              'Use the real scenario set names on the shapes. Do not substitute A, B, C, D or E when the sets have descriptive names. Use a legend only when each set has a visually distinct shape type; otherwise label the repeated shapes directly.',
              'For diagram answer options, vary the actual containment, overlap, exclusion or nesting geometry between options. Each option has its own independent visual spec. Do not reuse the same shape coordinates and merely change the option title or explanation.',
              'In qualitative diagram options, make intended overlap and separation visually decisive. Separated sets need a visible gap; overlapping sets need a substantial visible intersection. Do not use tangent or near-tangent boundaries to express a logical relationship.',
              'Diagram answer options are fully supported. When the designated source uses diagram answer options, each option answerText must be an array containing its own visual block, with consistent set identities and one unambiguously correct diagram.',
              'Keep each visual spec focused on examinable geometry, set names, and region values. Every numeric regionLabel must identify its exact semantic set region using region or include/exclude arrays and provide an x/y point visibly inside that cell.',
              'For mixed or nested shapes, construct the geometry first and verify that every declared include/exclude membership cell has non-zero visible area. Do not mechanically emit all seven three-set regions when the chosen shapes do not create them. Omit unused nonexistent cells rather than attaching values to impossible regions.',
              'Include enough labelled regions for the task to require genuine diagram interpretation when the task is numeric. Qualitative diagram-answer options do not require invented numeric labels. Keep the scenario, set names, values, relationships, and reasoning new.',
              'A numeric diagram should normally contain several meaningfully populated regions. Avoid a token three-number diagram unless those three regions still support a realistic multi-step set inference.',
            ]
          : []),
        ...(input.categoryName === 'Recognising Assumptions'
          ? [
              'Construct exactly four arguments with only one unambiguously strongest option. The strongest must directly answer the policy question, cite relevant evidence or a testable fact, and explain a decisive mechanism.',
              'Give each distractor exactly one clear weakness: emotive assertion, tangential concern, unsupported prediction, anecdote, or scope too narrow to answer the policy question. Do not include a second evidence-based argument that directly answers the question from the opposite side.',
              'In the explanation, name the strength criteria first, apply them consistently to all four options, and do not dismiss a directly relevant argument merely because it supports the opposite conclusion.',
            ]
          : []),
        ...(input.categoryName === 'Most/Least Appropriate'
          ? [
              'Present the three Most/Least actions in varied order across stems. Do not list them most-keyed first, unkeyed second, and least-keyed third every time.',
              'Keep each answerKeyValue attached to the correct action text regardless of display order.',
            ]
          : []),
        'In questionText, wrap decisive logical qualifiers such as MUST, CANNOT, COULD, EXCEPT, NOT, ALWAYS, LEAST, MOST, TRUE, and FALSE in **bold markers** and capitalize them. Do not bold ordinary words.',
        'Do not copy selected source examples, scenario premises, distinctive data relationships, or near-exact wording.',
        'Follow explanationPolicy for explanation location, teaching content, presentation, and maths formatting.',
        'Every single_choice or situational_judgement_rating question must have exactly one answerKeyValue="correct" option.',
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
                responseType: 'multiple_choice|drag_and_drop',
                answerScheme: 'single_choice|situational_judgement_rating|decision_making_binary_placement|situational_judgement_most_least',
                answerExplanation: 'string or GeneratedContentBlock[] or null',
                difficultyTarget: 'easy|medium|hard|mixed',
                timeBurdenTarget: 'low|medium|high|mixed',
                estimatedDifficulty: 0.5,
                estimatedTimeBurdenSeconds: 90,
                tagIds: ['one or more exact UUIDs from availableQuestionTags'],
                options: [
                  {
                    answerText: 'string or GeneratedContentBlock[]',
                    answerExplanation: 'string or GeneratedContentBlock[] or null',
                    answerKeyValue: 'correct|yes|no|most|least|null',
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
