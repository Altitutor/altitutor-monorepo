-- Seed default UCAT sections and question stem categories from dev database
-- Uses INSERT ... ON CONFLICT (id) DO NOTHING so re-running is safe
-- Sections: Verbal Reasoning, Decision Making, Quantitative Reasoning, Situational Judgement

INSERT INTO public.ucat_sections (
  id,
  section_number,
  name,
  display_columns,
  instructions_text,
  instructions_time_limit_seconds,
  number_of_questions,
  time_limit_seconds,
  created_by,
  updated_by
)
VALUES
  (
    'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc',
    1,
    'Verbal Reasoning',
    2,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"In this subtest you will be presented with 11 passages of text to read, each associated with four questions.","type":"text"}]},{"type":"paragraph","content":[{"text":"Each question has three or four answer options. You may only select one response.","type":"text"}]},{"type":"paragraph","content":[{"text":"It is in your best interest to answer all questions as there is no penalty for guessing. All unanswered questions will be scored as incorrect.","type":"text"}]},{"type":"paragraph","content":[{"text":"The ''Navigator'' function at the bottom right of the screen allows you to navigate to questions within the subtest.","type":"text"}]},{"type":"paragraph","content":[{"text":"Please click the Next (N) button to proceed before the time on this screen expires.","type":"text"}]}]}'::jsonb,
    90,
    44,
    1320,
    NULL,
    NULL
  ),
  (
    'd777da9c-e74c-4ff2-9d45-93f93e60f73a',
    2,
    'Decision Making',
    1,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"In this subtest you will be presented with questions that may refer to text, charts, tables, graphs or diagrams. Additional information may be presented within the question itself. All questions are standalone and do not share data.","type":"text"}]},{"type":"paragraph","content":[{"text":"Some questions have four answer options, but you may only select one response.","type":"text"}]},{"type":"paragraph","content":[{"text":"Other questions require you to respond to five statements by placing a ''yes'' or ''no'' answer next to each statement.","type":"text"}]},{"type":"paragraph","content":[{"text":"An onscreen calculator is available to assist you in this subtest – you can access this by clicking on the icon at the top left of the screen. The calculator can be operated by using the mouse or the number pad on the keyboard.","type":"text"}]},{"type":"paragraph","content":[{"text":"Troubleshooting tips:","type":"text"}]},{"type":"paragraph","content":[{"text":"   • Ensure that ''Num Lock'' is on for the number pad to work.","type":"text"}]},{"type":"paragraph","content":[{"text":"   • Most calculator issues can be resolved by clicking the ON/C button or closing the calculator and relaunching.","type":"text"}]},{"type":"paragraph","content":[{"text":"You may also need to use your notebook and pen in this subtest.","type":"text"}]},{"type":"paragraph","content":[{"text":"It is in your best interest to answer all questions as there is no penalty for guessing. All unanswered questions will be scored as incorrect.","type":"text"}]},{"type":"paragraph","content":[{"text":"The ''Navigator'' function at the bottom right of the screen allows you to navigate to questions within the subtest.","type":"text"}]},{"type":"paragraph","content":[{"text":"Please click the Next (N) button to proceed before the time on this screen expires.","type":"text"}]}]}'::jsonb,
    90,
    35,
    2220,
    NULL,
    NULL
  ),
  (
    '71269ce7-2364-454f-b056-7de66399ce77',
    3,
    'Quantitative Reasoning',
    2,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"For each question you may only select one response. ","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"It is in your best interest to answer all questions as there is no penalty for guessing. Unanswered questions will be scored as incorrect.","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"An ","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":"onscreen calculator","type":"text","marks":[{"type":"bold"}]},{"text":" can be accessed by clicking on the icon at the top left. The calculator can be operated by using the mouse or the number pad on the keyboard.","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"If you experience a problem with the calculator, try these troubleshooting tips: ","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"   ","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":"•","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"14pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":" Ensure that ''Num Lock'' is on for the number pad to work.","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"   ","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":"•","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"14pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":" Most calculator problems can be resolved by clicking the ON/C button or closing the calculator and relaunching.","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"   ","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":"•","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"14pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":" Use your mouse instead of the keyboard to operate the calculator","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"You may also need to use your notebook and pen in this subtest. If you require a replacement hold the notebook or pen in the air to request one from the invigilator. Check your pen is working before you start to avoid interruptions during the subtest.","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"The","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":" ''Navigator''","type":"text","marks":[{"type":"bold"}]},{"text":" function at the bottom right of the screen allows you to navigate to questions within the subtest.","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]},{"type":"paragraph","content":[{"text":"Please click the ","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]},{"text":"Next (N)","type":"text","marks":[{"type":"bold"}]},{"text":" button to proceed before the time on this screen expires.","type":"text","marks":[{"type":"textStyle","attrs":{"color":"","fontSize":"11pt","fontFamily":"arial","lineHeight":"","backgroundColor":""}}]}]}]}'::jsonb,
    120,
    36,
    1560,
    NULL,
    NULL
  ),
  (
    '8dfbf286-e952-4581-b065-255ead834628',
    4,
    'Situational Judgement',
    2,
    '{"type":"doc","content":[{"type":"paragraph","content":[{"text":"You will be presented with a set of hypothetical scenarios based in a clinical setting or during educational training for a medical or dental career.","type":"text"}]},{"type":"paragraph","content":[{"text":"You will be asked to rate the importance or appropriateness of a series of statements in response to each scenario.","type":"text"}]},{"type":"paragraph","content":[{"text":"Some questions have four answer options, but you may only select one response.","type":"text"}]},{"type":"paragraph","content":[{"text":"Others require you to choose the most and least appropriate action to take in response to the scenario, from the three actions provided.","type":"text"}]},{"type":"paragraph","content":[{"text":"It is in your best interest to answer all questions as there is no penalty for guessing. All unanswered questions will be scored as incorrect.","type":"text"}]},{"type":"paragraph","content":[{"text":"The ''Navigator'' function at the bottom right of the screen allows you to navigate to questions within the subtest.","type":"text"}]},{"type":"paragraph","content":[{"text":"Please click the Next (N) button to proceed before the time on this screen expires.","type":"text"}]}]}'::jsonb,
    1800,
    69,
    1560,
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Question stem categories (must run after sections due to FK)
INSERT INTO public.question_stem_categories (
  id,
  name,
  description,
  ucat_section_id,
  parent_question_stem_category_id,
  created_by,
  updated_by
)
VALUES
  -- Verbal Reasoning
  ('6e445f57-7ee1-4cc7-8e46-3a928fb2ab7e', 'Reading Comprehension', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc', NULL, NULL, NULL),
  ('688dac8f-03e3-43aa-97e3-90a2f7e68b04', 'True, False, Can''t Tell', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'f659f363-ffcc-4ade-ad2f-8a9dd3a4dfcc', NULL, NULL, NULL),
  -- Decision Making
  ('2367bab9-c94a-4996-9511-064eaef1588d', 'Drawing Conclusions', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'd777da9c-e74c-4ff2-9d45-93f93e60f73a', NULL, NULL, NULL),
  ('1ec3d39d-ae61-4ea6-9cef-bd149a96fd3a', 'Logical Puzzles', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'd777da9c-e74c-4ff2-9d45-93f93e60f73a', NULL, NULL, NULL),
  ('af97ced6-4266-4926-988b-2cc6cf288e23', 'Probabilistic and Statistical Reasoning', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'd777da9c-e74c-4ff2-9d45-93f93e60f73a', NULL, NULL, NULL),
  ('8ef50cb7-d273-4a99-80d8-98d47c9daaa0', 'Recognising Assumptions', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'd777da9c-e74c-4ff2-9d45-93f93e60f73a', NULL, NULL, NULL),
  ('b35d193a-d054-4ac2-8ae3-669ac1ff79bc', 'Syllogisms', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'd777da9c-e74c-4ff2-9d45-93f93e60f73a', NULL, NULL, NULL),
  ('cf18a7ff-7ba4-4d9d-96c7-5ee04da9762b', 'Venn Diagrams', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, 'd777da9c-e74c-4ff2-9d45-93f93e60f73a', NULL, NULL, NULL),
  -- Situational Judgement
  ('fd2027c9-e72e-4bb1-b4ec-96159320f98c', 'How Appropriate', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, '8dfbf286-e952-4581-b065-255ead834628', NULL, NULL, NULL),
  ('5a3d031c-64ec-4e2b-a8a5-2ee21efe8fb4', 'How Important', '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb, '8dfbf286-e952-4581-b065-255ead834628', NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;
