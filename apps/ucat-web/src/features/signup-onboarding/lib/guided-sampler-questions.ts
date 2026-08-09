import type { QuestionEngineQuestion } from "@/features/question-engine/model/types";

export type GuidedSamplerSection = {
  key: "vr" | "dm" | "qr" | "sjt";
  shortName: string;
  name: string;
  purpose: string;
  /**
   * Official exam seconds per question for this section
   * (`ucat_sections.time_limit_seconds / number_of_questions`).
   */
  timePerQuestionSeconds: number;
  questions: QuestionEngineQuestion[];
};

export type GuidedSamplerFeedback = {
  explanation: string;
  hints: [string, string, string];
  highlightText?: string;
  optionFeedback?: Record<string, string>;
  syllogismHints?: Record<string, [string, string]>;
};

function option(id: string, index: number, text: string, isAnswer = false) {
  return { id, index, text, isAnswer };
}

/**
 * Official UCAT section timings (seconds per question), matching the DB
 * generated column `ucat_sections.time_per_question`.
 * VR 1320/44 · DM 2220/35 · QR 1560/36 · SJ 1560/69
 */
export const SECTION_EXAM_SECONDS_PER_QUESTION = {
  vr: 1320 / 44,
  dm: 2220 / 35,
  qr: 1560 / 36,
  sjt: 1560 / 69,
} as const;

/**
 * Inactivity levels at 1×, 1.5×, 2×, 2.5×… section exam timing.
 * Returns null before 1× has elapsed.
 */
export function inactivityHintLevel(
  elapsedMs: number,
  timePerQuestionSeconds: number,
): number | null {
  if (timePerQuestionSeconds <= 0 || elapsedMs < 0) return null;
  const units = elapsedMs / (timePerQuestionSeconds * 1000);
  if (units < 1) return null;
  return Math.floor((units - 1) / 0.5);
}

export const INACTIVITY_NUDGE_TITLE = "Need a nudge?";

const VR_PASSAGE =
  "For much of the twentieth century, city rivers were treated mainly as drains and transport corridors. Many were straightened, channelled through concrete, or hidden underground. More recently, some councils have begun restoring rivers to a more natural form. This involves removing concrete banks and reintroducing wetlands, which can slow storm water, create wildlife habitat and give residents access to green space. \nThe work is not straightforward: restored rivers need room to spread during heavy rain, which can conflict with nearby roads or buildings. Projects also require ongoing monitoring because newly planted banks may erode before vegetation becomes established. Supporters argue that these costs should be compared with the expense of maintaining ageing concrete channels and repairing flood damage. However, restoration is not suitable everywhere. In densely built areas, engineers may retain some artificial structures while improving only selected sections of a river.";

const QR_TABLE =
  "A community pool recorded the following Saturday admissions:\n\nAdult: 40 admissions at $12 each\nChild: 35 admissions at $8 each\nConcession: 20 admissions at $9 each";

export const GUIDED_SAMPLER_SECTIONS: GuidedSamplerSection[] = [
  {
    key: "vr",
    shortName: "VR",
    name: "Verbal Reasoning",
    purpose:
      "Read the stem first, then return to it for evidence after reading the question.",
    timePerQuestionSeconds: SECTION_EXAM_SECONDS_PER_QUESTION.vr,
    questions: [
      {
        id: "sampler-vr-1",
        stemId: "sampler-vr-stem",
        sectionName: "Verbal Reasoning",
        sectionDisplayColumns: 2,
        stemText: VR_PASSAGE,
        questionText:
          "Restoring urban rivers can create habitats for wildlife.",
        questionType: "multiple_choice",
        options: [
          option("sampler-vr-1-a", 0, "True", true),
          option("sampler-vr-1-b", 1, "False"),
          option("sampler-vr-1-c", 2, "Can’t tell"),
        ],
      },
      {
        id: "sampler-vr-2",
        stemId: "sampler-vr-stem",
        sectionName: "Verbal Reasoning",
        sectionDisplayColumns: 2,
        stemText: VR_PASSAGE,
        questionText:
          "According to the passage, why do restored river projects need ongoing monitoring?",
        questionType: "multiple_choice",
        options: [
          option(
            "sampler-vr-2-a",
            0,
            "Nearby roads become blocked by wildlife habitat",
          ),
          option(
            "sampler-vr-2-b",
            1,
            "Newly planted banks may erode before vegetation becomes established",
            true,
          ),
          option(
            "sampler-vr-2-c",
            2,
            "Storm water can no longer slow down once wetlands are reintroduced",
          ),
          option(
            "sampler-vr-2-d",
            3,
            "Concrete channels become more expensive to maintain after restoration begins",
          ),
        ],
      },
    ],
  },
  {
    key: "dm",
    shortName: "DM",
    name: "Decision Making",
    purpose: "Use only the stated facts and accept only certain conclusions.",
    timePerQuestionSeconds: SECTION_EXAM_SECONDS_PER_QUESTION.dm,
    questions: [
      {
        id: "sampler-dm-syllogism",
        stemId: "sampler-dm-syllogism-stem",
        sectionName: "Decision Making",
        sectionDisplayColumns: 1,
        stemText:
          "All members of the Cedar Club are cyclists.\nNo cyclist is a swimmer.\nSome swimmers are musicians.",
        questionText:
          "Place ‘Yes’ if the conclusion follows. Place ‘No’ if it does not follow.",
        questionType: "syllogism",
        options: [
          option(
            "sampler-dm-syllogism-a",
            0,
            "No member of the Cedar Club is a swimmer.",
            true,
          ),
          option(
            "sampler-dm-syllogism-b",
            1,
            "Some members of the Cedar Club are musicians.",
          ),
          option(
            "sampler-dm-syllogism-c",
            2,
            "Some musicians are swimmers.",
            true,
          ),
          option("sampler-dm-syllogism-d", 3, "No musician is a cyclist."),
          option(
            "sampler-dm-syllogism-e",
            4,
            "All cyclists are members of the Cedar Club.",
          ),
        ],
      },
      {
        id: "sampler-dm-logic",
        stemId: "sampler-dm-logic-stem",
        sectionName: "Decision Making",
        sectionDisplayColumns: 1,
        stemText:
          "Four talks - History, Medicine, Science and Travel - are scheduled in a particular order.\nHistory is before Medicine.\nScience is immediately after History.\nTravel is last.",
        questionText: "Which talk must be second?",
        questionType: "multiple_choice",
        options: [
          option("sampler-dm-logic-a", 0, "History"),
          option("sampler-dm-logic-b", 1, "Medicine"),
          option("sampler-dm-logic-c", 2, "Science", true),
          option("sampler-dm-logic-d", 3, "Travel"),
        ],
      },
    ],
  },
  {
    key: "qr",
    shortName: "QR",
    name: "Quantitative Reasoning",
    purpose: "Identify the required numbers, then do one clean calculation.",
    timePerQuestionSeconds: SECTION_EXAM_SECONDS_PER_QUESTION.qr,
    questions: [
      {
        id: "sampler-qr-1",
        stemId: "sampler-qr-stem",
        sectionName: "Quantitative Reasoning",
        sectionDisplayColumns: 1,
        stemText: QR_TABLE,
        questionText: "How much revenue came from adult admissions?",
        questionType: "multiple_choice",
        options: [
          option("sampler-qr-1-a", 0, "$320"),
          option("sampler-qr-1-b", 1, "$360"),
          option("sampler-qr-1-c", 2, "$480", true),
          option("sampler-qr-1-d", 3, "$760"),
        ],
      },
      {
        id: "sampler-qr-2",
        stemId: "sampler-qr-stem",
        sectionName: "Quantitative Reasoning",
        sectionDisplayColumns: 1,
        stemText: QR_TABLE,
        questionText:
          "Concession admissions were what percentage of all admissions? Give your answer to the nearest whole percent.",
        questionType: "multiple_choice",
        options: [
          option("sampler-qr-2-a", 0, "19%"),
          option("sampler-qr-2-b", 1, "21%", true),
          option("sampler-qr-2-c", 2, "24%"),
          option("sampler-qr-2-d", 3, "27%"),
        ],
      },
    ],
  },
  {
    key: "sjt",
    shortName: "SJ",
    name: "Situational Judgement",
    purpose:
      "Judge the behaviour against professional duties and patient safety.",
    timePerQuestionSeconds: SECTION_EXAM_SECONDS_PER_QUESTION.sjt,
    questions: [
      {
        id: "sampler-sjt-1",
        stemId: "sampler-sjt-stem",
        sectionName: "Situational Judgement",
        sectionDisplayColumns: 2,
        stemText:
          "Mina, a medical student, notices that another student has posted a photograph from a teaching ward on social media. A patient’s name is visible on a board in the background. Mina privately tells the student, who says the post will disappear after 24 hours and refuses to remove it.",
        questionText:
          "How appropriate is it for Mina to raise the matter promptly with her supervising clinician?",
        questionType: "multiple_choice",
        options: [
          option("sampler-sjt-1-a", 0, "A very appropriate thing to do", true),
          option("sampler-sjt-1-b", 1, "Appropriate, but not ideal"),
          option("sampler-sjt-1-c", 2, "Inappropriate, but not awful"),
          option("sampler-sjt-1-d", 3, "A very inappropriate thing to do"),
        ],
      },
      {
        id: "sampler-sjt-2",
        stemId: "sampler-sjt-stem",
        sectionName: "Situational Judgement",
        sectionDisplayColumns: 2,
        stemText:
          "Mina, a medical student, notices that another student has posted a photograph from a teaching ward on social media. A patient’s name is visible on a board in the background. Mina privately tells the student, who says the post will disappear after 24 hours and refuses to remove it.",
        questionText:
          "How important is the fact that the post will disappear after 24 hours when deciding what Mina should do?",
        questionType: "multiple_choice",
        options: [
          option("sampler-sjt-2-a", 0, "Very important"),
          option("sampler-sjt-2-b", 1, "Important"),
          option("sampler-sjt-2-c", 2, "Of minor importance", true),
          option("sampler-sjt-2-d", 3, "Not important at all"),
        ],
      },
    ],
  },
];

export const GUIDED_SAMPLER_FEEDBACK: Record<string, GuidedSamplerFeedback> = {
  "sampler-vr-1": {
    explanation:
      "The passage directly says that restoring rivers can ‘create wildlife habitat’, so the statement is True.",
    hints: [
      "Find the sentence containing ‘wildlife habitat’, then compare that sentence directly with the statement in the question.",
      "The passage says reintroducing wetlands can create wildlife habitat.",
      "The statement repeats information stated directly in the passage, so it is True.",
    ],
    highlightText:
      "This involves removing concrete banks and reintroducing wetlands, which can slow storm water, create wildlife habitat and give residents access to green space.",
  },
  "sampler-vr-2": {
    explanation:
      "The passage says projects need ongoing monitoring because newly planted banks may erode before vegetation becomes established. That reason is stated directly, so you do not need to infer anything extra.",
    hints: [
      "Find ‘ongoing monitoring’ in the passage and read the reason given immediately after it.",
      "Find the sentence that explains why monitoring is needed after planting.",
      "The passage links monitoring to erosion of newly planted banks before vegetation is established.",
    ],
    highlightText:
      "Projects also require ongoing monitoring because newly planted banks may erode before vegetation becomes established.",
    optionFeedback: {
      "sampler-vr-2-a":
        "The passage mentions rivers needing room near roads or buildings, not wildlife habitat blocking roads. Look for the sentence about ongoing monitoring.",
      "sampler-vr-2-c":
        "The passage says reintroducing wetlands can slow storm water, so this option reverses that detail. Look for the sentence about ongoing monitoring.",
      "sampler-vr-2-d":
        "Supporters compare restoration costs with maintaining concrete channels, but that is not given as the reason for monitoring. Look for the sentence about newly planted banks.",
    },
  },
  "sampler-dm-syllogism": {
    explanation:
      "Cedar members cannot be swimmers because every Cedar member is a cyclist and no cyclist is a swimmer. ‘Some swimmers are musicians’ also guarantees that some musicians are swimmers. The remaining conclusions reverse or overextend the rules.",
    hints: [
      "Check each conclusion against the three facts. Choose Yes only if those facts make the conclusion unavoidable; otherwise choose No.",
      "Chain Cedar member → cyclist → not swimmer, and do not reverse ‘all Cedar members are cyclists’.",
      "The five judgements are Yes, No, Yes, No, No.",
    ],
    syllogismHints: {
      "sampler-dm-syllogism-a": [
        "Link Cedar member → cyclist with the rule that no cyclist is a swimmer.",
        "Every Cedar member is a cyclist, and no cyclist swims, so this conclusion follows: Yes.",
      ],
      "sampler-dm-syllogism-b": [
        "The facts connect musicians to some swimmers, but never connect musicians to Cedar members.",
        "A Cedar member could be a musician, but it is not guaranteed, so this is No.",
      ],
      "sampler-dm-syllogism-c": [
        "‘Some swimmers are musicians’ can be read in either direction for those same people.",
        "Those people are both swimmers and musicians, so some musicians are swimmers: Yes.",
      ],
      "sampler-dm-syllogism-d": [
        "Some musicians are swimmers, but that does not describe every musician.",
        "Other musicians could be cyclists, so ‘No musician is a cyclist’ is not certain: No.",
      ],
      "sampler-dm-syllogism-e": [
        "Do not reverse ‘All Cedar members are cyclists’.",
        "We know Cedar members are cyclists, not that all cyclists are Cedar members, so this is No.",
      ],
    },
  },
  "sampler-dm-logic": {
    explanation:
      "History and Science form the fixed block H–S. Travel is fourth, so H–S must occupy positions one and two. Science must therefore be second.",
    hints: [
      "Put History and Science together as H–S because Science is immediately after History. Then place Travel fourth.",
      "Treat History–Science as a two-position block, then place Travel fourth.",
      "The only order is History, Science, Medicine, Travel.",
    ],
  },
  "sampler-qr-1": {
    explanation:
      "There were 40 adult admissions at $12 each, so adult revenue was 40 × $12 = $480.",
    hints: [
      "Use the Adult row only: multiply 40 adult admissions by the $12 adult ticket price.",
      "The calculation is 40 × $12.",
      "Enter 40 × 12 into the calculator to get $480.",
    ],
    highlightText: "Adult: 40 admissions at $12 each",
    optionFeedback: {
      "sampler-qr-1-a":
        "$320 uses the $8 child ticket price: 40 × $8. Adult tickets cost $12.",
      "sampler-qr-1-b":
        "$360 uses the $9 concession price: 40 × $9. Use the adult price instead.",
      "sampler-qr-1-d":
        "$760 combines adult and child revenue. This question asks only for adult admissions.",
    },
  },
  "sampler-qr-2": {
    explanation:
      "There were 95 admissions in total. Concessions were 20 ÷ 95 × 100 = 21.05%, which rounds to 21%.",
    hints: [
      "Use concession admissions as the part (20) and all admissions as the whole (40 + 35 + 20), then calculate part ÷ whole × 100.",
      "The part is 20 and the whole is 40 + 35 + 20.",
      "Calculate 20 ÷ 95 × 100, then round to the nearest whole percent.",
    ],
  },
  "sampler-sjt-1": {
    explanation:
      "The confidentiality breach is ongoing and the student has refused to correct it. Promptly escalating to a supervising clinician is proportionate and protects the patient.",
    hints: [
      "A patient’s name is visible, so confidentiality is already breached. Judge whether telling a supervisor is a proportionate response after the student refuses to remove the post.",
      "The first private approach did not resolve the confidentiality breach.",
      "Escalating to someone able to act is a very appropriate response.",
    ],
  },
  "sampler-sjt-2": {
    explanation:
      "The 24-hour limit may reduce the duration of exposure, but it does not undo the breach or remove the need to act. It is therefore only of minor importance.",
    hints: [
      "The patient’s name is exposed even if the post disappears after 24 hours. Decide how much that time limit should affect Mina’s duty to act.",
      "Temporary exposure is still exposure of patient-identifiable information.",
      "The time limit matters slightly, but confidentiality remains the decisive issue.",
    ],
  },
};
