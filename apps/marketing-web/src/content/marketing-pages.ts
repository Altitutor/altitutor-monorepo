export type MarketingPageKind =
  | "home"
  | "courses"
  | "course-detail"
  | "resources"
  | "about"
  | "about-detail"
  | "contact"
  | "legal"
  | "standard";

export type MarketingPageCard = {
  title: string;
  description: string;
  href?: string;
  actionLabel?: string;
};

export type MarketingPageSection = {
  eyebrow?: string;
  heading: string;
  body?: string[];
  list?: string[];
  cards?: MarketingPageCard[];
};

export type MarketingPage = {
  path: string;
  title: string;
  description: string;
  kind: MarketingPageKind;
  modified: string;
  hero: {
    noun: string;
    power: string;
    image?: string;
  };
  seo: {
    title: string;
    description: string;
    keywords: string[];
    index?: boolean;
  };
  sections: MarketingPageSection[];
};

const baseKeywords = [
  "Adelaide tutoring",
  "Adelaide tutors",
  "SACE tutoring Adelaide",
  "UCAT preparation Adelaide",
  "school tutoring Adelaide",
];

export const marketingPages: MarketingPage[] = [
  {
    path: "/",
    title: "Altitutor",
    description:
      "Adelaide tutoring for students who want schoolwork to become easier, with weekly classes, online resources and a not-for-profit model.",
    kind: "home",
    modified: "2026-06-28",
    hero: {
      noun: "Tutoring is the",
      power: "Advantage",
      image: "/images/marketing/resources-devices.png",
    },
    seo: {
      title: "Altitutor | Maths, Physics, Chemistry and Biology tutoring Adelaide",
      description:
        "Altitutor provides Adelaide tutoring, SACE weekly classes, UCAT preparation, exam revision and online resources through a not-for-profit education model.",
      keywords: [...baseKeywords, "Maths tutoring Adelaide", "Chemistry tutoring Adelaide"],
    },
    sections: [],
  },
  {
    path: "/classes/",
    title: "Courses",
    description:
      "Choose the pathway that matches what you need now: weekly subject tutoring, exam preparation, English drafting, UCAT preparation or medical interviews.",
    kind: "courses",
    modified: "2026-06-29",
    hero: {
      noun: "Need is the",
      power: "Map",
      image: "/images/marketing/pre-course-prep.png",
    },
    seo: {
      title: "Tutoring courses Adelaide | Altitutor",
      description:
        "Explore Altitutor courses for SACE weekly tutoring, UCAT preparation, English drafting, exam revision and medical interview preparation in Adelaide.",
      keywords: [...baseKeywords, "SACE courses Adelaide", "Year 11 tutoring Adelaide", "Year 12 tutoring Adelaide"],
    },
    sections: [
      {
        eyebrow: "Course pathways",
        heading: "Different students need different kinds of help.",
        body: [
          "Some students need weekly support so school feels easier. Some need a short, intensive push before final exams. Others are preparing for medicine entry or need structured English drafting.",
          "Start by choosing the closest situation. If you are unsure, book a free trial session and we will help you pick the right pathway.",
        ],
        cards: [
          {
            title: "Weekly subject tutoring",
            description: "Small-group weekly classes for students who want to learn ahead, revise consistently and prepare for school assessments.",
            href: "/classes/weekly-classes/",
          },
          {
            title: "Exam preparation",
            description: "Intensive SACE exam preparation for students who want whole-subject review, practice exams and final-week strategy.",
            href: "/classes/examprep/",
          },
          {
            title: "English drafting",
            description: "Year 11-12 English support for students who need help starting, structuring or refining an assignment.",
            href: "/classes/english-assignment-drafting/",
          },
          {
            title: "UCAT preparation",
            description: "Strategy, timing and question-bank practice for students preparing for medicine entry.",
            href: "/classes/ucatprep/",
          },
          {
            title: "Medical interviews",
            description: "Interview preparation after offers, with realistic prompts, mock interviews and communication feedback.",
            href: "/classes/medical-interview-preparation/",
          },
        ],
      },
      {
        eyebrow: "Choose by situation",
        heading: "Not sure what to choose?",
        list: [
          "If schoolwork is consistently hard, start with weekly subject tutoring.",
          "If you already understand the subject but want top scores, weekly classes can place you with students at a similar level.",
          "If you only need help for final exams, use exam preparation.",
          "If you need English feedback, use drafting support rather than a general weekly class.",
          "If your goal is medicine entry, choose UCAT preparation first, then medical interview preparation after interview offers.",
        ],
      },
      {
        eyebrow: "What every pathway includes",
        heading: "Teaching is backed by resources and support.",
        cards: [
          { title: "Free trial first", description: "Meet the tutor, ask questions and work out the right course before committing." },
          { title: "Online resources", description: "Notes, video lessons, practice questions, tests and exams reinforce what is taught." },
          { title: "Help outside class", description: "Enrolled students can access question support and homework help where relevant." },
          { title: "Not-for-profit model", description: "Revenue supports teaching, resources and subsidised tuition for students who need access." },
        ],
      },
    ],
  },
  {
    path: "/classes/weekly-classes/",
    title: "Weekly classes",
    description:
      "Build momentum with small-group classes taught ahead of school, supported by homework help, online resources and tutor guidance.",
    kind: "course-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Weekly rhythm is the",
      power: "Compounder",
      image: "/images/marketing/chemistry-notes.png",
    },
    seo: {
      title: "Weekly SACE tutoring classes Adelaide | Altitutor",
      description:
        "Small-group weekly SACE tutoring in Adelaide for Maths, Chemistry, Physics, Biology and English, with resources and homework help included.",
      keywords: [...baseKeywords, "weekly tutoring Adelaide", "SACE weekly classes"],
    },
    sections: [
      {
        eyebrow: "Weekly tuition",
        heading: "Learn ahead, then prepare for every assessment.",
        body: [
          "Weekly classes are for students who want schoolwork to become easier through consistent teaching, deliberate revision and assessment preparation.",
          "Students are grouped by learning ability and subject need, with catch-up support available before joining a class when required.",
        ],
        cards: [
          { title: "When", description: "Classes run after school on weekdays and across weekends, depending on subject and availability." },
          { title: "Where", description: "Level 1, 17A Solomon St, Adelaide SA 5000." },
          { title: "Cost", description: "$50 per hour, or $75 for a 90-minute class, with subsidy options where available." },
        ],
      },
      {
        eyebrow: "Why study with us?",
        heading: "Small classes with support around the lesson.",
        cards: [
          { title: "Trusted tutors", description: "Top-achieving tutors who know the subjects, assessments and pressure points." },
          { title: "Free homework help", description: "Weekly students can attend a free 3-hour homework help session for questions and assignments." },
          { title: "Student portal", description: "Students can access notes, practice questions, video lessons, tests and exams online." },
          { title: "Question helpline", description: "Unlimited question support helps students keep moving during the week." },
        ],
      },
      {
        eyebrow: "Method",
        heading: "How weekly classes work.",
        list: [
          "Start with revision and consolidation so earlier content stays active.",
          "Learn ahead of school using notes and practice questions.",
          "Prepare for assessments with topic tests, exam strategies and tutor feedback.",
          "Use homework help when schoolwork, assignments or missed lessons need extra attention.",
        ],
      },
      {
        eyebrow: "Resources included",
        heading: "The lesson continues online.",
        cards: [
          { title: "Study notes", description: "Topic notes are used in class and remain available for revision." },
          { title: "Flashcards", description: "A spaced-repetition system helps students keep definitions and formulas fresh." },
          { title: "Practice questions", description: "Topic questions help students move from recognition to application." },
          { title: "Practice tests", description: "Tests and exams help students rehearse the conditions of real assessments." },
          { title: "Video lessons", description: "Students can revisit explanations outside class." },
        ],
      },
      {
        eyebrow: "Subjects offered",
        heading: "Support across school years and senior subjects.",
        list: [
          "Primary and Year 7-10 Maths and Science foundations.",
          "SACE Mathematical Methods, Specialist Mathematics and General Mathematics.",
          "SACE Chemistry, Physics and Biology.",
          "IB Maths and Sciences where availability allows.",
          "English support through dedicated drafting sessions.",
        ],
      },
      {
        eyebrow: "Getting started",
        heading: "Begin with a free trial session.",
        list: [
          "Book a trial session and bring questions, a topic, or an assessment you want help with.",
          "Meet the tutor and see how the teaching model works.",
          "If it is a fit, select your availability and we will confirm the right class time.",
        ],
      },
    ],
  },
  {
    path: "/classes/english-assignment-drafting/",
    title: "English assignment drafting",
    description:
      "Get structured Year 11-12 English feedback on coherence, fluency, argument and analysis so each draft becomes easier to improve.",
    kind: "course-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Drafting is the",
      power: "Refinement",
      image: "/images/marketing/english-draft.png",
    },
    seo: {
      title: "English assignment drafting Adelaide | Altitutor",
      description:
        "Altitutor provides English drafting support for Adelaide students, with feedback on argument, structure, expression and analysis.",
      keywords: [...baseKeywords, "English drafting Adelaide", "SACE English drafting"],
    },
    sections: [
      {
        eyebrow: "Drafting support",
        heading: "Feedback that makes the next draft clearer.",
        body: [
          "Drafting helps students see what is working, what is unclear and what needs stronger evidence, fluency or analysis.",
          "The focus is on improving the student's writing process and final submission, whether they are starting from a plan or refining a completed draft.",
        ],
        cards: [
          { title: "When", description: "Book a time that suits you and send your draft and task sheet before the session." },
          { title: "Where", description: "Level 1, 17A Solomon St, Adelaide SA 5000." },
          { title: "Cost", description: "$50 per hour, or $75 for a 90-minute session, with subsidy options where available." },
        ],
      },
      {
        eyebrow: "Why draft with us?",
        heading: "Support for the whole writing process.",
        cards: [
          { title: "Experienced tutors", description: "Tutors understand senior English assessment expectations and how to explain feedback clearly." },
          { title: "Writing guides", description: "Students can use guides and checklists to understand structure, analysis and expression." },
          { title: "Multiple revisions", description: "Students can return with a new version and keep improving the same assignment." },
          { title: "From scratch or final polish", description: "Sessions can help with planning, paragraph structure, or detailed final refinement." },
        ],
      },
      {
        eyebrow: "Process",
        heading: "How drafting works.",
        list: [
          "Email your draft and task sheet at least a day before the session.",
          "Your tutor reviews the task and prepares detailed feedback before you arrive.",
          "In the session, you work through grammar, organisation, fluency, substance and analysis.",
          "After the session, you revise with a clearer checklist for the next draft.",
        ],
      },
      {
        eyebrow: "What feedback covers",
        heading: "Clearer writing without replacing your voice.",
        cards: [
          { title: "Coherence", description: "Make the argument easier to follow from sentence to paragraph to whole essay." },
          { title: "Fluency", description: "Improve expression, rhythm and readability without making the writing sound artificial." },
          { title: "Analysis", description: "Strengthen evidence, explanation and links back to the task." },
          { title: "Structure", description: "Refine paragraph order, topic sentences and transitions." },
        ],
      },
      {
        eyebrow: "Subjects covered",
        heading: "Built for senior English assessments.",
        list: [
          "SACE English Literary Studies.",
          "SACE English.",
          "SACE Essential English.",
          "English as an Additional Language.",
          "Assignment guides, annotated drafts and A+ exemplars where relevant.",
        ],
      },
      {
        eyebrow: "Booking workflow",
        heading: "Send the right material before the session.",
        body: [
          "After booking, send the draft, task sheet and any teacher instructions to english@altitutor.com so the tutor can prepare useful feedback.",
        ],
      },
    ],
  },
  {
    path: "/classes/examprep/",
    title: "Exam preparation",
    description: "Prepare for SACE Stage 2 final exams with whole-subject review, focused practice and exam-style feedback.",
    kind: "course-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Revision is the",
      power: "Rehearsal",
      image: "/images/marketing/chemistry-exam.png",
    },
    seo: {
      title: "Exam preparation tutoring Adelaide | Altitutor",
      description:
        "Prepare for SACE exams with targeted revision, timed practice, feedback and exam-style resources from Altitutor.",
      keywords: [...baseKeywords, "exam preparation Adelaide", "SACE exam prep"],
    },
    sections: [
      {
        eyebrow: "Exam prep",
        heading: "Review the whole subject, then practise under pressure.",
        body: [
          "Exam preparation is built for students approaching SACE Stage 2 final examinations who need more than scattered revision.",
          "Sessions review the whole subject, identify forgotten critical areas, teach strategies and shortcuts, and move students into exam-style practice.",
        ],
        cards: [
          { title: "Summary sheets", description: "Condensed notes help students see the whole subject and locate gaps quickly." },
          { title: "Focused questions", description: "Practice is organised around topics and skills rather than random revision." },
          { title: "Practice exams", description: "Students rehearse full-length papers and learn how to mark and improve from them." },
          { title: "Workshop tables", description: "Tutors can direct students to personalised topic work during intensive sessions." },
        ],
      },
      {
        eyebrow: "Course details",
        heading: "Designed for the final stretch.",
        list: [
          "Intensive weekly sessions in the lead-up to exams.",
          "Support for Maths and Science subjects where timetables and tutor availability allow.",
          "Closed-book full-length final practice when students are ready.",
          "24/7 question support and tutor guidance for enrolled students.",
          "Cancellation, payment and subsidy options follow the same practical model as weekly classes.",
        ],
      },
      {
        eyebrow: "Getting started",
        heading: "Use the trial to diagnose the plan.",
        list: [
          "Book a free trial session with the subject and exam goals in mind.",
          "Bring recent tests, topics you are worried about, or questions you cannot solve.",
          "Use the session to decide whether an exam preparation block is the right fit.",
          "Confirm availability and the subject-specific timetable before enrolling.",
        ],
      },
    ],
  },
  {
    path: "/classes/ucatprep/",
    title: "UCAT preparation",
    description:
      "Move from UCAT question-type recognition and strategy to timed section performance with practice that actually changes behaviour.",
    kind: "course-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Practice is the",
      power: "Edge",
      image: "/images/marketing/ucat-qr-online.png",
    },
    seo: {
      title: "UCAT preparation Adelaide | Altitutor",
      description:
        "Altitutor UCAT preparation teaches timing, question-type recognition and strategies for Verbal Reasoning, Decision Making, Quantitative Reasoning and Abstract Reasoning.",
      keywords: [...baseKeywords, "UCAT Adelaide", "UCAT tutoring", "medicine entry preparation"],
    },
    sections: [
      {
        eyebrow: "UCAT prep",
        heading: "The work between sessions matters most.",
        body: [
          "UCAT tutoring is useful only when it changes how students practise. The course starts with strategy and question-type recognition, then pushes students into consistent, effective practice.",
          "Students learn when to slow down, when to move on, and how to turn review into better decisions in the next timed set.",
        ],
        cards: [
          { title: "Untimed practice sets", description: "Build strategy and accuracy before racing the clock." },
          { title: "Timed practice sets", description: "Train decision rules, skipping habits and section pacing." },
          { title: "Full-length exams", description: "Rehearse the pressure and stamina of the real test." },
          { title: "Online question bank", description: "Access thousands of questions for structured practice and review." },
        ],
      },
      {
        eyebrow: "Method",
        heading: "Learn, prepare, assess.",
        list: [
          "Learn the question types and the strategy that applies to each one.",
          "Prepare with untimed and timed sets so the strategy becomes automatic.",
          "Assess with full-length exams and review routines that expose the next gap.",
        ],
      },
      {
        eyebrow: "Why Altitutor?",
        heading: "Small groups, high-scoring tutors and support outside class.",
        cards: [
          { title: "Grouped by stage", description: "Students work with others at a similar preparation stage and ability level." },
          { title: "Medical-student tutors", description: "Tutors have performed strongly in UCAT and understand medicine-entry pressure." },
          { title: "Question helpline", description: "Students can ask questions during the week instead of waiting for the next class." },
          { title: "Subsidy options", description: "The not-for-profit model helps keep access wider where cost would otherwise block preparation." },
        ],
      },
      {
        eyebrow: "Sections covered",
        heading: "Practice across every UCAT subtest.",
        cards: [
          { title: "Verbal Reasoning", description: "Passage handling, keyword selection and answer elimination." },
          { title: "Decision Making", description: "Logic, probability, argument evaluation and syllogism strategy." },
          { title: "Quantitative Reasoning", description: "Fast setup, graph interpretation and calculator discipline." },
          { title: "Abstract Reasoning", description: "Pattern families, distractors and efficient set comparison." },
        ],
      },
      {
        eyebrow: "Getting started",
        heading: "Start with the stage you are actually at.",
        body: [
          "Use the trial session to discuss current preparation, timing, target date and the practice habits you need to build before committing to a regular class.",
        ],
      },
    ],
  },
  {
    path: "/classes/medical-interview-preparation/",
    title: "Medical interview preparation",
    description:
      "Prepare for medicine interviews with realistic prompts, mock interviews, feedback and clearer personal examples.",
    kind: "course-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Interview prep is the",
      power: "Signal",
      image: "/images/marketing/josh.jpg",
    },
    seo: {
      title: "Medical interview preparation Adelaide | Altitutor",
      description:
        "Prepare for medicine interviews with Altitutor through realistic prompts, answer structure, communication feedback and personal example refinement.",
      keywords: [...baseKeywords, "medical interview preparation", "medicine interview Adelaide"],
    },
    sections: [
      {
        eyebrow: "Interview prep",
        heading: "Practise the real interview, not a script.",
        body: [
          "Strong medicine interviews require more than memorised answers. Students need to understand the prompt, communicate with maturity and use personal examples that actually answer the question.",
          "The course covers the full interview process, from question approach and professional presentation to mock interviews and feedback.",
        ],
        cards: [
          { title: "Doctor talks", description: "Students hear from doctors and medical students about the realities behind the profession." },
          { title: "Mock interviews", description: "Multiple realistic mocks help students rehearse under pressure before the real interview." },
          { title: "1-on-1 feedback", description: "Students receive spoken and written feedback on answer structure, examples and delivery." },
          { title: "Pre-reading", description: "Information sheets introduce interview formats, question types and expected preparation." },
        ],
      },
      {
        eyebrow: "Method",
        heading: "Learn, prepare, simulate.",
        list: [
          "Learn what interviewers are assessing and how different question types work.",
          "Prepare personal experiences, ethics reasoning and motivation for medicine.",
          "Simulate the interview with realistic prompts, time pressure and feedback.",
          "Refine delivery so answers sound structured without sounding scripted.",
        ],
      },
      {
        eyebrow: "Resources",
        heading: "Preparation material around the mocks.",
        cards: [
          { title: "Information sheets", description: "Guides explain formats, question types and preparation priorities." },
          { title: "Past questions", description: "Students practise with prompts that reflect the style of real interviews." },
          { title: "Mock feedback", description: "Written notes help students track strengths, gaps and next steps." },
          { title: "Presentation guidance", description: "Students discuss professional communication, including appropriate interview attire." },
        ],
      },
      {
        eyebrow: "When to book",
        heading: "Best after interview offers are released.",
        body: [
          "The trial is most useful once a student has an interview offer or a clear interview timeline. Bring the university, interview format and any prompt types you are worried about.",
        ],
      },
    ],
  },
  {
    path: "/resources/",
    title: "Resources",
    description:
      "Use notes, flashcards, practice questions, video lessons and exams that reinforce the same methods taught in class.",
    kind: "resources",
    modified: "2026-06-29",
    hero: {
      noun: "Resources are the",
      power: "System",
      image: "/images/marketing/anki-devices.png",
    },
    seo: {
      title: "Online study resources | Altitutor",
      description:
        "Altitutor students access online notes, practice questions, video lessons, tests and exams that connect with weekly tutoring.",
      keywords: [...baseKeywords, "study resources", "SACE practice questions"],
    },
    sections: [
      {
        eyebrow: "Online resources",
        heading: "Resources that continue the lesson.",
        body: [
          "Altitutor resources cover each offered subject and topic. They are used in lessons, printed where useful, and available online so students can revise outside class.",
          "The goal is continuity: students should recognise the same methods, examples and practice structure whether they are in class or studying at home.",
        ],
        cards: [
          { title: "Study notes", description: "Topic notes designed for class learning, revision and quick reference." },
          { title: "Flashcards", description: "A flashcard system helps students remember definitions, formulas and common facts." },
          { title: "Practice questions", description: "Questions help students move from recognition to application." },
          { title: "Practice tests", description: "Topic tests check whether students can apply content under assessment-style conditions." },
          { title: "Practice exams", description: "Full-length tasks help students rehearse timing, stamina and exam strategy." },
          { title: "Video lessons", description: "Students can revisit explanations when class content needs reinforcement." },
        ],
      },
      {
        eyebrow: "Student dashboard",
        heading: "Everything in one place.",
        body: [
          "Current students use the online dashboard to access notes, tests, solutions, video lessons and practice material for the courses they study with Altitutor.",
          "Resources also support at-home study, so students can keep working when they are stuck between lessons.",
        ],
      },
      {
        eyebrow: "Access",
        heading: "For current students and online-only learners.",
        cards: [
          { title: "Current students", description: "Enrolled students receive access to resources connected to the courses they study with us." },
          { title: "Online-only access", description: "Students who only need resources can ask about online access without joining a weekly class." },
          { title: "Tutor support", description: "Where enrolled support applies, students can ask tutors questions while studying at home." },
        ],
      },
    ],
  },
  {
    path: "/about/",
    title: "About us",
    description:
      "Altitutor is a not-for-profit Adelaide tutoring company built by tutors who wanted a better model: personalised teaching, complete support and wider access.",
    kind: "about",
    modified: "2026-06-29",
    hero: {
      noun: "Teaching is the",
      power: "Mission",
      image: "/images/marketing/profile-matthew.jpg",
    },
    seo: {
      title: "About Altitutor | Not-for-profit tutoring Adelaide",
      description:
        "Learn about Altitutor, a not-for-profit tutoring company in Adelaide offering weekly classes, resources, homework support and subsidised tuition.",
      keywords: [...baseKeywords, "not-for-profit tutoring", "Altitutor Adelaide", "subsidised tutoring Adelaide"],
    },
    sections: [
      {
        eyebrow: "Founding idea",
        heading: "A better way to do tuition.",
        body: [
          "Altitutor was founded by tutors who wanted students to get the best parts of private tutoring and larger education programs without losing personal support.",
          "The model combines small-group teaching, comprehensive resources, ongoing guidance and a subsidy program for students who could otherwise be priced out.",
        ],
      },
    ],
  },
  {
    path: "/about/testimonials/",
    title: "Testimonials",
    description:
      "See Altitutor results, student outcomes and testimonials from weekly classes, resources and medicine-entry preparation.",
    kind: "about-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Results are the",
      power: "Proof",
      image: "/images/marketing/darshil.jpg",
    },
    seo: {
      title: "Student testimonials | Altitutor",
      description:
        "Read student testimonials about Altitutor weekly classes, UCAT preparation, medical interview preparation and SACE tutoring.",
      keywords: [...baseKeywords, "Altitutor reviews", "student testimonials"],
    },
    sections: [
      {
        eyebrow: "Results and testimonials",
        heading: "Outcomes matter, but no result is automatic.",
        body: [
          "The live testimonials page combines student results with review themes. The strongest pattern is not a single miracle result; it is clearer teaching, structured practice and students knowing what to work on next.",
          "Individual outcomes still depend on the student, subject, timing and consistency of practice.",
        ],
      },
      {
        eyebrow: "What students mention",
        heading: "Clarity, resources and confidence.",
        cards: [
          {
            title: "Weekly classes",
            description:
              "Students point to clearer explanations, better routines and more confidence before assessments.",
          },
          {
            title: "Resources",
            description:
              "Students value notes, practice questions, tests and online access that match what tutors teach.",
          },
          {
            title: "Medicine entry",
            description:
              "UCAT and interview students describe structured strategy, realistic practice and useful feedback.",
          },
          {
            title: "English drafting",
            description:
              "Drafting support is valued for making writing, structure and analysis easier to improve.",
          },
        ],
      },
      {
        eyebrow: "How to read results",
        heading: "Statistics need context.",
        list: [
          "Results are useful indicators, not guarantees for any individual student.",
          "Course ratings and student reviews reflect particular cohorts and subjects.",
          "Outcomes are shaped by starting point, effort, attendance and assessment conditions.",
          "The safest way to judge fit is still to book a trial session and sample the teaching.",
        ],
      },
      {
        eyebrow: "Review us",
        heading: "Student feedback keeps the program honest.",
        body: [
          "Current and past students can share a review after using Altitutor. The useful reviews are specific: what changed, what helped, and what future students should know.",
        ],
      },
    ],
  },
  {
    path: "/about/subsidy/",
    title: "Tuition subsidy",
    description:
      "Our subsidy program helps students access tutoring when cost would otherwise keep support out of reach.",
    kind: "about-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Subsidy is the",
      power: "Bridge",
    },
    seo: {
      title: "Tuition subsidy programme | Altitutor",
      description:
        "Altitutor's subsidy programme helps students access tutoring support when cost would otherwise be a barrier.",
      keywords: [...baseKeywords, "subsidised tutoring Adelaide", "tuition subsidy"],
    },
    sections: [
      {
        eyebrow: "Subsidy program",
        heading: "Money should not decide who gets academic support.",
        body: [
          "Tutoring can create an unfair advantage, especially in competitive pathways like Medicine and Dentistry where preparation costs can shape access.",
          "Altitutor keeps programs as affordable as possible and offers free or reduced-cost study where fees would still prevent a student from getting support.",
        ],
      },
      {
        eyebrow: "How it works",
        heading: "Apply, talk with us, then agree on what is affordable.",
        list: [
          "Email the team with the student's year level, subjects and reason for applying.",
          "Attend an interview or discussion so we can understand the student's situation and goals.",
          "Discuss what level of fee, if any, would be affordable.",
          "If support is available, register with the subsidised fee arrangement.",
        ],
      },
      {
        eyebrow: "What to include",
        heading: "Give us enough context to make a fair decision.",
        list: [
          "Student name, year level and school.",
          "Subjects or course pathway they want support with.",
          "What academic goal or barrier prompted the application.",
          "Relevant financial or family context.",
          "Best contact details for a follow-up conversation.",
        ],
      },
      {
        eyebrow: "Contact",
        heading: "Start by emailing the team.",
        body: [
          "Send subsidy questions or applications to admin@altitutor.com. We will respond with the next step when places and funding are available.",
        ],
      },
    ],
  },
  {
    path: "/about/apply/",
    title: "Work with us",
    description:
      "Join a tutor-led team across tutoring, resources, administration, marketing, media and technology.",
    kind: "about-detail",
    modified: "2026-06-29",
    hero: {
      noun: "Teaching is the",
      power: "Craft",
      image: "/images/marketing/tutor-apply.jpg",
    },
    seo: {
      title: "Tutor jobs Adelaide | Work with Altitutor",
      description:
        "Apply to work with Altitutor as a tutor in Adelaide and contribute to clear teaching, strong resources and accessible student support.",
      keywords: [...baseKeywords, "tutor jobs Adelaide", "work with Altitutor"],
    },
    sections: [
      {
        eyebrow: "Open roles",
        heading: "More than one kind of work keeps Altitutor running.",
        body: [
          "Altitutor hires people who can teach, build resources, support administration, improve marketing and help the learning platform keep moving.",
          "The right fit is not only about marks. We look for clear communication, reliability and care for students.",
        ],
        cards: [
          { title: "Tutors", description: "Teach small classes, explain clearly and support students through assessment pressure." },
          { title: "Resource tutors", description: "Build notes, practice questions, tests and explanations that match our teaching model." },
          { title: "Administration", description: "Help families, bookings, communication and student support run smoothly." },
          { title: "Marketing and media", description: "Create content, campaigns and media that explain what Altitutor offers." },
          { title: "IT team", description: "Support the systems behind online resources, student access and internal workflows." },
        ],
      },
      {
        eyebrow: "What working here is like",
        heading: "Clear teaching, prepared resources and a student-first team.",
        list: [
          "Tutors work with small classes rather than crowded rooms.",
          "Resources and devices are provided so tutors can focus on teaching well.",
          "Resource work can be flexible and self-logged where the role allows it.",
          "The team is built around strong pay, high standards and the not-for-profit mission.",
        ],
      },
      {
        eyebrow: "How to apply",
        heading: "Send a resume and the role you are interested in.",
        body: [
          "Email your resume to admin@altitutor.com and include the role you want to apply for, your availability and the subjects or skills you can contribute.",
        ],
      },
    ],
  },
  {
    path: "/about/contact/",
    title: "Contact us",
    description: "Send us an SMS or email, book a trial session, or visit our Adelaide CBD learning centre.",
    kind: "contact",
    modified: "2026-06-29",
    hero: {
      noun: "Conversation is the",
      power: "Start",
    },
    seo: {
      title: "Contact Altitutor | Adelaide tutoring",
      description:
        "Contact Altitutor in Adelaide to book a trial session, ask about weekly classes, UCAT preparation or tutoring availability.",
      keywords: [...baseKeywords, "contact Altitutor", "Adelaide tutoring contact"],
    },
    sections: [
      {
        eyebrow: "Our details",
        heading: "Questions or meeting requests are best sent by SMS or email.",
        body: [
          "Contact the team if you have questions about subjects, availability, trial sessions, subsidy support or the right course pathway.",
        ],
        cards: [
          { title: "Email", description: "admin@altitutor.com", href: "mailto:admin@altitutor.com", actionLabel: "Email us" },
          { title: "SMS or phone", description: "0483 849 842", href: "tel:+61483849842", actionLabel: "Call us" },
          { title: "Location", description: "Level 1, 17A Solomon St, Adelaide SA 5000" },
          { title: "Map", description: "Open the Adelaide CBD learning centre in Google Maps.", href: "https://maps.google.com/?q=Level%201%2017A%20Solomon%20St%20Adelaide%20SA%205000", actionLabel: "Open map" },
        ],
      },
    ],
  },
  {
    path: "/terms-of-service/",
    title: "Terms of service",
    description: "Terms of service information for Altitutor.",
    kind: "legal",
    modified: "2026-06-29",
    hero: {
      noun: "Terms are the",
      power: "Agreement",
    },
    seo: {
      title: "Terms of service | Altitutor",
      description: "Read terms of service information for Altitutor.",
      keywords: ["Altitutor terms", "terms of service"],
    },
    sections: [
      {
        eyebrow: "Terms of Service",
        heading: "Terms of Service.",
        body: [
          "The current live Altitutor terms page only contains a Terms of Service heading and does not publish detailed legal clauses.",
          "For questions about bookings, services, resources or website use, contact Altitutor directly using the details below.",
        ],
      },
      {
        eyebrow: "Contact details",
        heading: "Ask the team for current service terms.",
        cards: [
          { title: "Email", description: "admin@altitutor.com", href: "mailto:admin@altitutor.com", actionLabel: "Email us" },
          { title: "Phone", description: "0483 849 842", href: "tel:+61483849842", actionLabel: "Call us" },
          { title: "Legal entity", description: "Altitutor Pty Ltd, ACN 639 197 167." },
          { title: "Address", description: "Level 1, 17A Solomon St, Adelaide SA 5000." },
        ],
      },
    ],
  },
];

export const sitemapPages = marketingPages.filter((page) => page.seo.index !== false);
