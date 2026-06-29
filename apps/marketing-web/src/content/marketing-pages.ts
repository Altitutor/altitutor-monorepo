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
      "Choose the pathway that matches your goals: weekly subject tutoring, UCAT preparation, English drafting, exam revision and medical interviews.",
    kind: "courses",
    modified: "2026-06-28",
    hero: {
      noun: "Course choice is the",
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
        heading: "Choose the support that fits the outcome.",
        body: [
          "Altitutor courses are built around clear teaching, practice resources and a path from trial session to regular support.",
          "Students can join weekly subject classes, prepare for UCAT, refine English assignments, rehearse exams or practise medical interviews.",
        ],
        cards: [
          {
            title: "Weekly subject tutoring",
            description: "Small-group weekly classes taught ahead of school with notes, practice questions and tutor support.",
            href: "/classes/weekly-classes/",
          },
          {
            title: "UCAT preparation",
            description: "Strategy, timing and question-type recognition for students preparing for medicine entry.",
            href: "/classes/ucatprep/",
          },
          {
            title: "English drafting",
            description: "Detailed feedback on argument, clarity, expression and analysis for senior English assignments.",
            href: "/classes/english-assignment-drafting/",
          },
          {
            title: "Exam preparation",
            description: "Targeted revision, timed practice and mark-scheme feedback before major assessments.",
            href: "/classes/examprep/",
          },
          {
            title: "Medical interviews",
            description: "Structured interview practice with feedback on examples, communication and answer shape.",
            href: "/classes/medical-interview-preparation/",
          },
        ],
      },
      {
        heading: "Every course connects teaching with resources.",
        list: [
          "Free 1 hour trial session before committing.",
          "Online notes, video lessons, practice questions and exams.",
          "Question help outside class for enrolled students.",
          "Not-for-profit model that supports subsidised tuition.",
        ],
      },
    ],
  },
  {
    path: "/classes/weekly-classes/",
    title: "Weekly classes",
    description:
      "Build momentum with small-group classes taught ahead of school, supported by notes, practice questions and tutor guidance.",
    kind: "course-detail",
    modified: "2026-06-28",
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
        heading: "Learn ahead, practise deliberately, keep momentum.",
        body: [
          "Weekly classes are designed for students who want schoolwork to become easier through consistent teaching and structured revision.",
          "Students are grouped by level and learning needs so the class pace is useful rather than generic.",
        ],
        list: [
          "Content taught ahead of school where possible.",
          "Practice questions and exams aligned with the class programme.",
          "Homework help and question support for enrolled students.",
          "A transition plan for students who need catch-up before joining a group.",
        ],
      },
      {
        heading: "Subjects we support.",
        cards: [
          { title: "Mathematics", description: "Methods, Specialist Mathematics and foundation support where appropriate." },
          { title: "Sciences", description: "Chemistry, Physics and Biology teaching with topic-level practice." },
          { title: "English", description: "Analytical writing support, drafting habits and assessment preparation." },
        ],
      },
    ],
  },
  {
    path: "/classes/english-assignment-drafting/",
    title: "English assignment drafting",
    description:
      "Get structured feedback on argument, clarity, expression and analysis so each draft becomes easier to improve.",
    kind: "course-detail",
    modified: "2026-06-28",
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
          "Drafting helps students see what is working, what is unclear and what needs stronger evidence or analysis.",
          "The focus is on building the student's writing process, not replacing their voice.",
        ],
        list: [
          "Argument and thesis clarity.",
          "Paragraph structure and sequencing.",
          "Expression, fluency and tone.",
          "Evidence selection and depth of analysis.",
        ],
      },
      {
        heading: "Useful for senior assessment pressure.",
        body: [
          "Students can use drafting support when they are stuck, when they want a higher standard of refinement, or when they need a clearer plan before submission.",
        ],
      },
    ],
  },
  {
    path: "/classes/examprep/",
    title: "Exam preparation",
    description: "Turn revision into a clear plan with targeted teaching, timed practice and exam-style feedback.",
    kind: "course-detail",
    modified: "2026-06-28",
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
        heading: "Practise the exam before the exam.",
        body: [
          "Exam preparation works best when students combine topic diagnosis with timed practice and feedback.",
          "Altitutor helps students turn revision into a sequence of decisions: what to revise, how to test it and how to improve after marking.",
        ],
        list: [
          "Topic review based on gaps and assessment goals.",
          "Timed questions and full-length practice exams.",
          "Mark-scheme feedback and solution strategy.",
          "Revision planning for the final weeks before exams.",
        ],
      },
    ],
  },
  {
    path: "/classes/ucatprep/",
    title: "UCAT preparation",
    description:
      "Learn the strategies, timing decisions and question-type recognition needed for confident UCAT practice.",
    kind: "course-detail",
    modified: "2026-06-28",
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
        heading: "Strategy first, then volume with feedback.",
        body: [
          "UCAT practice is most useful when students understand what a question is asking, which strategy applies and when to move on.",
          "The course focuses on repeatable methods, timing control and realistic practice habits.",
        ],
        cards: [
          { title: "Verbal Reasoning", description: "Passage handling, keyword selection and answer elimination." },
          { title: "Decision Making", description: "Logic, probability, argument evaluation and syllogism strategy." },
          { title: "Quantitative Reasoning", description: "Fast setup, graph interpretation and calculator discipline." },
          { title: "Abstract Reasoning", description: "Pattern families, distractors and efficient set comparison." },
        ],
      },
      {
        heading: "Built for the pressure of the real test.",
        list: [
          "Timed practice and review routines.",
          "Question-type recognition before calculation.",
          "Section-specific decision rules.",
          "Support for building a sustainable preparation schedule.",
        ],
      },
    ],
  },
  {
    path: "/classes/medical-interview-preparation/",
    title: "Medical interview preparation",
    description:
      "Prepare for interviews with structured feedback, realistic prompts and clearer personal examples.",
    kind: "course-detail",
    modified: "2026-06-28",
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
        heading: "Turn experience into clear, assessable answers.",
        body: [
          "Strong interviews require more than memorised answers. Students need to identify the point of a prompt and communicate examples with structure and maturity.",
          "Sessions use realistic prompts, feedback and repetition so students become more confident under pressure.",
        ],
        list: [
          "Answer structure and communication feedback.",
          "Ethics, motivation and personal example prompts.",
          "Practice responding without sounding scripted.",
          "Reflection on strengths, gaps and next steps.",
        ],
      },
    ],
  },
  {
    path: "/resources/",
    title: "Resources",
    description:
      "Use notes, practice questions, video lessons and full exams that reinforce the same methods taught in class.",
    kind: "resources",
    modified: "2026-06-28",
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
        heading: "The same method, available outside class.",
        body: [
          "Resources help students continue the work between lessons, with material that matches the way tutors teach in class.",
        ],
        cards: [
          { title: "Notes", description: "Topic notes designed for revision and quick reference." },
          { title: "Practice questions", description: "Questions that help students move from recognition to application." },
          { title: "Video lessons", description: "Explanations that students can revisit when class content needs reinforcement." },
          { title: "Tests and exams", description: "Longer practice tasks for checking readiness before assessments." },
        ],
      },
    ],
  },
  {
    path: "/about/",
    title: "About us",
    description:
      "Altitutor is a not-for-profit Adelaide tutoring company built to improve results and make strong tutoring more accessible.",
    kind: "about",
    modified: "2026-06-28",
    hero: {
      noun: "Access is the",
      power: "Mission",
      image: "/images/marketing/profile-matthew.jpg",
    },
    seo: {
      title: "About Altitutor | Not-for-profit tutoring Adelaide",
      description:
        "Altitutor is a not-for-profit tutoring company in Adelaide offering weekly classes, resources and subsidised tuition.",
      keywords: [...baseKeywords, "not-for-profit tutoring", "Altitutor Adelaide"],
    },
    sections: [
      {
        eyebrow: "Our model",
        heading: "Strong tutoring should be more accessible.",
        body: [
          "Altitutor was built around a simple idea: excellent teaching, useful resources and student support should not be limited to families who can pay the most.",
          "Revenue from classes supports the tutoring team and helps fund subsidised tuition for students who need support.",
        ],
        list: [
          "Small-group teaching in Adelaide.",
          "Online resources that support enrolled students.",
          "A subsidy programme connected to the not-for-profit model.",
          "Tutors who know the subjects, assessments and pressure points.",
        ],
      },
    ],
  },
  {
    path: "/about/testimonials/",
    title: "Testimonials",
    description:
      "Hear from students who used Altitutor to sharpen subject knowledge, confidence and exam preparation.",
    kind: "about-detail",
    modified: "2026-06-28",
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
        eyebrow: "Student feedback",
        heading: "Students value clarity, structure and confidence.",
        cards: [
          {
            title: "Medicine interview preparation",
            description:
              "Students describe interview preparation as structured, practical and useful for turning experience into confident answers.",
          },
          {
            title: "Weekly classes",
            description:
              "Weekly students often point to clearer explanations, better routines and more confidence before assessments.",
          },
          {
            title: "Subject support",
            description:
              "Students use Altitutor to make difficult topics more manageable through teaching, practice and feedback.",
          },
        ],
      },
    ],
  },
  {
    path: "/about/subsidy/",
    title: "Tuition subsidy",
    description:
      "Our subsidy programme helps students access tutoring when cost would otherwise keep support out of reach.",
    kind: "about-detail",
    modified: "2026-06-28",
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
        eyebrow: "Subsidy programme",
        heading: "Cost should not be the reason a student misses support.",
        body: [
          "The subsidy programme is part of Altitutor's not-for-profit model. Where possible, revenue from paid classes helps make tutoring more accessible for students who need it.",
          "Families can contact the team to discuss circumstances, availability and whether subsidy support may be appropriate.",
        ],
      },
      {
        heading: "How to start.",
        list: [
          "Contact the team with the student's year level, subjects and goals.",
          "Book a trial session or discussion about the right support pathway.",
          "Share relevant context so the team can assess available support options.",
        ],
      },
    ],
  },
  {
    path: "/about/apply/",
    title: "Work with us",
    description:
      "Join a tutor-led team that cares about clear teaching, strong resources and accessible student support.",
    kind: "about-detail",
    modified: "2026-06-28",
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
        eyebrow: "Tutor applications",
        heading: "Work with students, resources and a clear teaching model.",
        body: [
          "Altitutor looks for tutors who can explain clearly, prepare carefully and support students with patience and high standards.",
          "The strongest tutors understand both the subject content and the experience of being a student under assessment pressure.",
        ],
        list: [
          "Strong academic record in relevant subjects.",
          "Clear communication and reliable preparation.",
          "Interest in improving resources and student support.",
          "Commitment to the not-for-profit mission.",
        ],
      },
    ],
  },
  {
    path: "/about/contact/",
    title: "Contact us",
    description: "Send us a message, book a trial session, or visit our Adelaide CBD learning centre.",
    kind: "contact",
    modified: "2026-06-28",
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
        eyebrow: "Contact",
        heading: "Start with a message or a trial session.",
        body: [
          "The fastest way to begin is to book a free 1 hour trial session. You can also message the team with questions about subjects, availability or the right pathway.",
        ],
        cards: [
          { title: "Email", description: "admin@altitutor.com", href: "mailto:admin@altitutor.com" },
          { title: "Phone", description: "0483 849 842", href: "tel:+61483849842" },
          { title: "Location", description: "Level 1, 17A Solomon St, Adelaide SA 5000" },
        ],
      },
    ],
  },
  {
    path: "/terms-of-service/",
    title: "Terms of service",
    description: "Terms for using Altitutor services and websites.",
    kind: "legal",
    modified: "2026-06-28",
    hero: {
      noun: "Terms are the",
      power: "Agreement",
    },
    seo: {
      title: "Terms of service | Altitutor",
      description: "Read the terms of service for Altitutor tutoring services and websites.",
      keywords: ["Altitutor terms", "terms of service"],
    },
    sections: [
      {
        eyebrow: "Terms",
        heading: "Using Altitutor services.",
        body: [
          "These terms describe the expected use of Altitutor services, websites, resources and booking pathways.",
          "Students and families should use resources for personal study, communicate respectfully with tutors and contact Altitutor if a booking or service issue needs to be resolved.",
        ],
      },
      {
        heading: "Bookings, resources and communication.",
        list: [
          "Trial sessions and tutoring arrangements depend on tutor availability.",
          "Online resources are provided for enrolled student learning and should not be redistributed.",
          "Altitutor may update service details, course availability and website content over time.",
          "Questions about terms or service use can be sent to admin@altitutor.com.",
        ],
      },
    ],
  },
];

export const sitemapPages = marketingPages.filter((page) => page.seo.index !== false);
