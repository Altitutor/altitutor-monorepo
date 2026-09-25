import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  HeartHandshake,
  Instagram,
  Facebook,
  Youtube,
  Linkedin,
  Twitter,
  Music2,
} from "lucide-react";
import { COURSE_LINKS, ONLINE_COURSES, PRODUCT_LINKS } from "@/lib/site";
import { PageMotion } from "./page-motion";
import { SectionNavigation } from "./section-navigation";
import { Navigation } from "./navigation";
import styles from "../marketing.module.css";

const companyLinks = [
  ["/about/", "About us"],
  ["/about/testimonials/", "Results & testimonials"],
  ["/about/subsidy/", "Tuition subsidy"],
  ["/about/apply/", "Work with us"],
  ["/about/contact/", "Contact us"],
];
const socialLinks = [
  ["Instagram", "https://www.instagram.com/altitutor/", Instagram],
  ["Facebook", "https://www.facebook.com/altitutoreducation/", Facebook],
  ["YouTube", "https://www.youtube.com/@altitutor", Youtube],
  ["TikTok", "https://www.tiktok.com/@altitutor", Music2],
  ["LinkedIn", "https://www.linkedin.com/company/altitutor/", Linkedin],
  ["Twitter", "https://twitter.com/Altitutor", Twitter],
] as const;

export function SiteFrame({ children }: { children: ReactNode }) {
  return (
    <div className={styles.site}>
      <Navigation />
      <PageMotion>{children}</PageMotion>
      <SectionNavigation />
      <footer className={styles.footer}>
        <div className={styles.footerTop}>
          <div>
            <Link href="/" className={styles.footerBrand}>
              altitutor.
            </Link>
            <p>
              <HeartHandshake size={22} aria-hidden="true" />
              A mission-driven non-profit providing accessible education for all
              students.
            </p>
          </div>
          <div>
            <h2>In person courses</h2>
            {COURSE_LINKS.map(([href, label]) => (
              <Link key={href} href={href}>
                {label}
              </Link>
            ))}
            <h2>Online courses</h2>
            {ONLINE_COURSES.map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
            <Link href="/online-courses/">All online courses</Link>
            <Link href={PRODUCT_LINKS.studentLogin}>
              Student sign in <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <div>
            <h2>Altitutor</h2>
            {companyLinks.map(([href, label]) => (
              <Link href={href} key={href}>
                {label}
              </Link>
            ))}
            <address>
              Level 1, 17A Solomon St
              <br />
              Adelaide SA 5000
            </address>
            <a href="mailto:admin@altitutor.com">admin@altitutor.com</a>
            <a href="sms:+61483849842">0483 849 842</a>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>
            © {new Date().getFullYear()} Altitutor Pty Ltd · ACN 639 197 167
          </p>
          <div>
            <Link href="/privacy-policy/">Privacy</Link>
            <Link href="/terms-of-service/">Terms</Link>
          </div>
          <div className={styles.socialLinks}>
            {socialLinks.map(([label, href, Icon]) => (
              <a
                href={href}
                key={label}
                aria-label={label}
                title={label}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Icon size={18} aria-hidden="true" />
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
