export const diagnosticLabels = [
  "Small-group weekly classes",
  "Catch-up 1:1 transition sessions",
  "Learn-ahead SACE curriculum",
];

export const telemetryMessages = [
  "UCAT prep: recognise question type -> choose strategy -> preserve timing.",
  "Interview prep: answer structure -> feedback loop -> confident delivery.",
  "Exam prep: topic diagnosis -> timed practice -> mark-scheme refinement.",
];

export const scheduleDays = ["S", "M", "T", "W", "T", "F", "S"];

export const manifestoWords =
  "We are a not-for-profit tutoring company built to make excellent education more accessible.".split(" ");

export const missionStats = [
  {
    value: "94%",
    description: "Of our graduating year 12s receive a university offer for their top preference.",
  },
  {
    value: "96%",
    description: "Of our students improve their grade by at least one grade band within one term.",
  },
  {
    value: "100+",
    description: "5 star reviews",
  },
];

export const protocolCards = [
  {
    number: "01",
    title: "Free homework help class",
    description:
      "All of our students may come to our 3 hour homework help class at no extra cost, where they can ask our knowledgable tutors questions or get help writing your assignments. We'll even draft your assignments in person for free.",
    motif: "helix",
  },
  {
    number: "02",
    title: "Tutors you can trust with your learning",
    description:
      "As top achieving students studying at universities around Adelaide, we know the SACE courses back to front, and have strategies and techniques for approaching assessments which are not found in textbooks.",
    motif: "scan",
  },
  {
    number: "03",
    title: "24/7 guidance and resource access",
    description:
      "Our students get unlimited access to our question helpline, where they can ask tutors any questions they have. Students also get free access to our online resources, which include notes, practice questions, video lessons and full length exams.",
    motif: "wave",
  },
  {
    number: "04",
    title: "A personalised learning experience",
    description:
      "Students are sorted into small classes based on learning ability, meaning all students in a class are at the same level. Group learning allows student to not only learn from their own mistakes, but also other students'.",
    motif: "orbit",
  },
];

export const steps = [
  "Click the link above to book a trial session with one of our tutors. During the trial session, our tutors explain how our programmes work and we organise availability.",
  "You study 1-on-1 with our tutors for a few sessions to catch up to the level of one of our classes. After these sessions, you get integrated into an appropriate class, with other students at your learning ability.",
  "In class each week, your tutor teaches you content ahead of your school, using notes, practice questions and practice exams. Because you’ve already learnt the content with us, learning content at school become easy, and you can focus on remembering the content rather than trying to learn it for the first time.",
  "At any time, you can access our online resources for free, which include notes, practice questions, tests and exams for every topic. Whenever you have an assignment or struggle with content in school, you come to our free homework help session. During this time, our friendly tutors help you with schoolwork and draft your assignments, for free!",
  "The money you pay for each session is used to pay for tuition for our students in our subsidy programme.",
];

export const testimonials = [
  {
    quote:
      "I had gone through several tutors for my medicine interview prep with little to no progress, and Matt was by far the best.",
    name: "Vyvian",
    meta: "Student, Medicine interview course",
  },
  {
    quote:
      "The weekly lessons with Sarah really improved my understanding of the subject and definitely helped me to succeed in achieving great marks.",
    name: "Neha",
    meta: "Student, Stage 2 Mathematical Methods",
  },
  {
    quote:
      "All of my biology lessons with Josh were enjoyable. Josh focuses on getting through theory so more time is able to spent doing practice questions.",
    name: "James",
    meta: "Student, Stage 2 Biology",
  },
  {
    quote:
      "The tutors explain concepts clearly and make difficult content feel manageable. I always left class knowing exactly what to work on next.",
    name: "Darshil",
    meta: "Student, SACE tutoring",
  },
  {
    quote:
      "Altitutor gave me structure, resources and feedback when school felt overwhelming. The homework help sessions were especially useful before assessments.",
    name: "Maddie",
    meta: "Student, weekly classes",
  },
  {
    quote:
      "The interview preparation helped me understand what assessors were looking for and how to communicate my experiences with confidence.",
    name: "Josh",
    meta: "Student, Medicine interview course",
  },
];

export const testimonialRows = [
  testimonials,
  [...testimonials].reverse(),
  testimonials.slice(2).concat(testimonials.slice(0, 2)),
];

export const sectionIndicators = [
  { id: "alti-home", label: "Altitutor" },
  { id: "overview", label: "Overview" },
  { id: "methodology", label: "Mission" },
  { id: "support", label: "Why choose us?" },
  { id: "how-it-works", label: "How it works" },
  { id: "pricing", label: "Get started" },
];
