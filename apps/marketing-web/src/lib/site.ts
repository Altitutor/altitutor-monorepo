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

export const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/classes/", label: "Courses" },
  { href: "/classes/weekly-classes/", label: "Weekly tutoring" },
  { href: "/classes/ucatprep/", label: "UCAT" },
  { href: "/resources/", label: "Resources" },
  { href: "/about/", label: "About" },
  { href: "/about/contact/", label: "Contact" },
];
