export const SITE_URL = "https://altitutor.com";

export const SITE_NAME = "Altitutor";

export const PRODUCT_LINKS = {
  student: "https://student.altitutor.com",
  ucat: "https://ucat.altitutor.com",
  trialBooking: "https://student.altitutor.com/booking/trial-session",
};

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/about/", label: "About" },
  { href: "/classes/", label: "Courses" },
  { href: "/resources/", label: "Resources" },
  { href: "/about/contact/", label: "Contact" },
];

export const COURSE_LINKS = [
  ["/classes/", "All courses"],
  ["/classes/weekly-classes/", "Weekly subject tutoring"],
  ["/classes/english-assignment-drafting/", "English drafting"],
  ["/classes/examprep/", "Exam preparation"],
  ["/classes/ucatprep/", "UCAT preparation"],
  ["/classes/medical-interview-preparation/", "Medical interviews"],
] as const;
