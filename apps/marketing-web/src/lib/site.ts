export const SITE_URL = "https://altitutor.com";

export const SITE_NAME = "Altitutor";

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "");
}

const UCAT_APP_ORIGIN = stripTrailingSlash(
  process.env.NEXT_PUBLIC_UCAT_APP_ORIGIN ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3004"
      : "https://ucat.altitutor.com"),
);

const STUDENT_APP_ORIGIN = stripTrailingSlash(
  process.env.NEXT_PUBLIC_STUDENT_URL ??
    (process.env.NODE_ENV === "development"
      ? "http://localhost:3001"
      : "https://student.altitutor.com"),
);

export const PRODUCT_LINKS = {
  student: STUDENT_APP_ORIGIN,
  studentLogin: `${STUDENT_APP_ORIGIN}/login`,
  ucat: UCAT_APP_ORIGIN,
  ucatLogin: `${UCAT_APP_ORIGIN}/login`,
  ucatSignup: `${UCAT_APP_ORIGIN}/signup`,
  trialBooking: `${STUDENT_APP_ORIGIN}/booking/trial-session`,
};

export const IN_PERSON_COURSES = [
  ["/classes/weekly-classes/", "Weekly subject tutoring"],
  ["/classes/examprep/", "Exam preparation courses"],
  ["/classes/assignment-drafting/", "Assignment drafting"],
  ["/classes/ucatprep/", "In person UCAT tutoring"],
] as const;

export const ONLINE_COURSES = [
  ["/online-courses/sace-ib-resources/", "Online SACE & IB resources"],
  ["/ucat/", "Altitutor UCAT"],
] as const;

export const COURSE_LINKS = [
  ["/classes/", "All in person courses"],
  ...IN_PERSON_COURSES,
  ["/classes/medical-interview-preparation/", "Medical interviews"],
] as const;

export const NAV_ITEMS = [
  { href: "/classes/", label: "In person courses" },
  { href: "/online-courses/", label: "Online courses" },
  { href: "/about/", label: "About us" },
  { href: "/about/contact/", label: "Contact" },
];
