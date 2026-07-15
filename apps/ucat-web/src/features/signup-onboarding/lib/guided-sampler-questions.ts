import type { QuestionEngineQuestion } from "@/features/question-engine/model/types";

export type GuidedSamplerSection = {
  key: "vr" | "dm" | "qr" | "sjt";
  shortName: string;
  name: string;
  purpose: string;
  questions: QuestionEngineQuestion[];
};

function option(id: string, index: number, text: string, isAnswer = false) {
  return { id, index, text, isAnswer };
}

export const GUIDED_SAMPLER_SECTIONS: GuidedSamplerSection[] = [
  {
    key: "vr",
    shortName: "VR",
    name: "Verbal Reasoning",
    purpose: "Find what the passage supports without adding assumptions.",
    questions: [
      {
        id: "sampler-vr-1",
        stemId: "sampler-vr-stem",
        sectionName: "Verbal Reasoning",
        sectionDisplayColumns: 2,
        stemText:
          "Urban trees reduce summer temperatures by shading buildings and releasing water vapour. They also provide habitats for birds and insects. Young trees, however, require regular watering and protection while they become established.",
        questionText: "Which statement is best supported by the passage?",
        questionType: "multiple_choice",
        options: [
          option("sampler-vr-1-a", 0, "Urban trees need no maintenance."),
          option(
            "sampler-vr-1-b",
            1,
            "Urban trees can cool their surroundings.",
            true,
          ),
          option("sampler-vr-1-c", 2, "Only mature trees provide habitats."),
          option("sampler-vr-1-d", 3, "Trees increase summer temperatures."),
        ],
      },
      {
        id: "sampler-vr-2",
        stemId: "sampler-vr-stem",
        sectionName: "Verbal Reasoning",
        sectionDisplayColumns: 2,
        stemText:
          "Urban trees reduce summer temperatures by shading buildings and releasing water vapour. They also provide habitats for birds and insects. Young trees, however, require regular watering and protection while they become established.",
        questionText: "Which claim is not stated in the passage?",
        questionType: "multiple_choice",
        options: [
          option("sampler-vr-2-a", 0, "Young trees may need protection."),
          option("sampler-vr-2-b", 1, "Trees provide animal habitats."),
          option(
            "sampler-vr-2-c",
            2,
            "Every city street has enough room for trees.",
            true,
          ),
          option("sampler-vr-2-d", 3, "Trees can shade buildings."),
        ],
      },
    ],
  },
  {
    key: "dm",
    shortName: "DM",
    name: "Decision Making",
    purpose: "Use only the rules given and keep track of certainty.",
    questions: [
      {
        id: "sampler-dm-1",
        stemId: "sampler-dm-stem",
        sectionName: "Decision Making",
        sectionDisplayColumns: 2,
        stemText:
          "A study group meets on Tuesday or Thursday. If Priya attends, Leo attends. Leo cannot attend on Tuesday. Priya attends this week.",
        questionText: "On which day must the group meet?",
        questionType: "multiple_choice",
        options: [
          option("sampler-dm-1-a", 0, "Tuesday"),
          option("sampler-dm-1-b", 1, "Thursday", true),
          option("sampler-dm-1-c", 2, "Either day is equally possible"),
          option("sampler-dm-1-d", 3, "The group cannot meet"),
        ],
      },
      {
        id: "sampler-dm-2",
        stemId: "sampler-dm-stem",
        sectionName: "Decision Making",
        sectionDisplayColumns: 2,
        stemText:
          "A study group meets on Tuesday or Thursday. If Priya attends, Leo attends. Leo cannot attend on Tuesday. Priya attends this week.",
        questionText: "Which conclusion follows?",
        questionType: "multiple_choice",
        options: [
          option("sampler-dm-2-a", 0, "Leo attends this week.", true),
          option("sampler-dm-2-b", 1, "Priya never attends on Tuesday."),
          option("sampler-dm-2-c", 2, "The group always meets on Thursday."),
          option("sampler-dm-2-d", 3, "Leo chooses the meeting day."),
        ],
      },
    ],
  },
  {
    key: "qr",
    shortName: "QR",
    name: "Quantitative Reasoning",
    purpose: "Turn the information into a short calculation.",
    questions: [
      {
        id: "sampler-qr-1",
        stemId: "sampler-qr-stem",
        sectionName: "Quantitative Reasoning",
        sectionDisplayColumns: 2,
        stemText:
          "A revision course has 18 students. Each student completes 4 timed drills during the week.",
        questionText: "How many timed drills are completed altogether?",
        questionType: "multiple_choice",
        options: [
          option("sampler-qr-1-a", 0, "22"),
          option("sampler-qr-1-b", 1, "54"),
          option("sampler-qr-1-c", 2, "72", true),
          option("sampler-qr-1-d", 3, "84"),
        ],
      },
      {
        id: "sampler-qr-2",
        stemId: "sampler-qr-stem",
        sectionName: "Quantitative Reasoning",
        sectionDisplayColumns: 2,
        stemText:
          "A revision course has 18 students. Each student completes 4 timed drills during the week. Each drill takes 15 minutes.",
        questionText: "How many minutes of drills does one student complete?",
        questionType: "multiple_choice",
        options: [
          option("sampler-qr-2-a", 0, "45"),
          option("sampler-qr-2-b", 1, "60", true),
          option("sampler-qr-2-c", 2, "72"),
          option("sampler-qr-2-d", 3, "90"),
        ],
      },
    ],
  },
  {
    key: "sjt",
    shortName: "SJT",
    name: "Situational Judgement",
    purpose: "Judge professional behaviour, not just the final outcome.",
    questions: [
      {
        id: "sampler-sjt-1",
        stemId: "sampler-sjt-stem",
        sectionName: "Situational Judgement",
        sectionDisplayColumns: 2,
        stemText:
          "During a clinic placement, Sam notices that a confidential patient list has been left visible in a public waiting area. No staff member is nearby.",
        questionText:
          "How appropriate is it for Sam to move the list out of public view and alert a supervisor?",
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
          "During a clinic placement, Sam notices that a confidential patient list has been left visible in a public waiting area. No staff member is nearby.",
        questionText:
          "How important is protecting patient confidentiality in deciding what Sam should do?",
        questionType: "multiple_choice",
        options: [
          option("sampler-sjt-2-a", 0, "Very important", true),
          option("sampler-sjt-2-b", 1, "Important"),
          option("sampler-sjt-2-c", 2, "Of minor importance"),
          option("sampler-sjt-2-d", 3, "Not important at all"),
        ],
      },
    ],
  },
];
