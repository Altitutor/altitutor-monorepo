// DEV-8 throwaway fixtures. IDs and all content are illustrative.
export type PrototypeQuestion = {
  id: string;
  question: string;
  prompt: string;
  rubric: string;
  categoryId: string;
  tagIds: string[];
  seconds: number;
  archived: boolean;
};
export type PrototypeCategory = { id: string; name: string; group: string };
export type PrototypeTag = { id: string; name: string };
export type PrototypeStation = {
  id: string;
  name: string;
  maximum: number;
  questionIds: string[];
};

export const initialCategories: PrototypeCategory[] = [
  { id: "motivation", group: "Personal", name: "Motivation" },
  { id: "experiences", group: "Personal", name: "Experiences" },
  { id: "qualities", group: "Personal", name: "Qualities" },
  { id: "profession", group: "Course", name: "Profession" },
  { id: "rural", group: "Course", name: "Rural medicine" },
  { id: "ethics", group: "Scenario", name: "Ethical scenarios" },
  { id: "problem", group: "Scenario", name: "Problem solving" },
];
export const initialTags: PrototypeTag[] = [
  { id: "empathy", name: "Empathy" },
  { id: "communication", name: "Communication" },
  { id: "teamwork", name: "Teamwork" },
  { id: "reflection", name: "Reflection" },
  { id: "confidentiality", name: "Confidentiality" },
];
export const initialQuestions: PrototypeQuestion[] = [
  {
    id: "q1",
    question: "How would you approach this conversation?",
    prompt:
      "You are a medical student on placement. A fellow student tells you they are struggling and have been missing clinical sessions. They ask you to keep the conversation between the two of you.",
    rubric:
      "Listen without assumptions. Explore immediate safety. Explain confidentiality and its limits. Discuss appropriate support together.",
    categoryId: "ethics",
    tagIds: ["empathy", "confidentiality"],
    seconds: 120,
    archived: false,
  },
  {
    id: "q2",
    question: "What if they ask you not to tell anyone?",
    prompt:
      "The student now tells you that they have been making mistakes during placement and are worried about the consequences of speaking up.",
    rubric:
      "Recognise the balance between trust and safety. Avoid promising absolute confidentiality. Explain next steps sensitively.",
    categoryId: "ethics",
    tagIds: ["communication", "confidentiality"],
    seconds: 120,
    archived: false,
  },
  {
    id: "q3",
    question: "Tell me about a time you supported someone.",
    prompt:
      "Think of an experience when someone needed your help. Consider what you did, what you learned and what you might do differently.",
    rubric:
      "Use a specific example, explain personal contribution and reflect on the outcome.",
    categoryId: "experiences",
    tagIds: ["empathy", "reflection"],
    seconds: 180,
    archived: false,
  },
  {
    id: "q4",
    question: "Why do you want to study medicine?",
    prompt:
      "Reflect on your reasons for pursuing medicine and the experiences that have shaped your understanding of the profession.",
    rubric:
      "Offer personal, grounded motivations. Show a realistic understanding of the role and its challenges.",
    categoryId: "motivation",
    tagIds: ["reflection"],
    seconds: 180,
    archived: false,
  },
  {
    id: "q5",
    question: "What have you learned from working in a team?",
    prompt:
      "Consider a team you have worked in where members had different perspectives or priorities.",
    rubric:
      "Explain how you listened, contributed and adapted. Reflect on the team outcome.",
    categoryId: "qualities",
    tagIds: ["teamwork", "communication"],
    seconds: 120,
    archived: false,
  },
  {
    id: "q6",
    question: "How could access to healthcare improve in rural communities?",
    prompt:
      "A small rural community has limited access to specialist care. Residents often travel several hours for appointments.",
    rubric:
      "Consider access, workforce, continuity and community perspectives. Explore feasible responses without assuming all rural communities are the same.",
    categoryId: "rural",
    tagIds: ["communication"],
    seconds: 180,
    archived: false,
  },
  {
    id: "q7",
    question: "How would you prioritise these competing requests?",
    prompt:
      "You are coordinating a student volunteering event. Two teams need the same limited equipment at the same time.",
    rubric:
      "Clarify needs, explain a fair process, consider alternatives and communicate the decision.",
    categoryId: "problem",
    tagIds: ["teamwork"],
    seconds: 120,
    archived: false,
  },
  {
    id: "q8",
    question: "What challenges do you expect in a medical career?",
    prompt:
      "Consider the professional and personal challenges that can arise in a medical career.",
    rubric:
      "Show realistic expectations, self-awareness and a willingness to seek support.",
    categoryId: "profession",
    tagIds: ["reflection"],
    seconds: 120,
    archived: false,
  },
];
export const initialStations: PrototypeStation[] = [
  {
    id: "s1",
    name: "Ethical reasoning",
    maximum: 6,
    questionIds: ["q1", "q2", "q3"],
  },
  {
    id: "s2",
    name: "Motivation for medicine",
    maximum: 6,
    questionIds: ["q4", "q8"],
  },
  { id: "s3", name: "Rural healthcare", maximum: 6, questionIds: ["q6"] },
];
