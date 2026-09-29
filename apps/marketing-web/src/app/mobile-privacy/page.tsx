import type { Metadata } from "next";
import Link from "next/link";

import { SiteFrame } from "@/features/marketing/components/site-frame";
import styles from "@/features/marketing/marketing.module.css";

export const metadata: Metadata = {
  title: "Mobile app privacy | Altitutor",
  description: "How Altitutor handles information in its student and UCAT mobile apps.",
};

export default function MobilePrivacyPage() {
  return (
    <SiteFrame>
      <section className={styles.legal}>
        <p className={styles.eyebrow}>Altitutor</p>
        <h1>Mobile app privacy</h1>
        <div className={styles.copy}>
          <p>Last updated: 29 September 2026</p>
          <p>
            This notice applies to the Altitutor Student and Altitutor UCAT mobile apps,
            including the account pages they open in a browser. It supplements our{" "}
            <Link href="/privacy-policy/">general privacy policy</Link>. Altitutor Pty Ltd
            is responsible for these services. Contact us at{" "}
            <a href="mailto:admin@altitutor.com">admin@altitutor.com</a>.
          </p>

          <h2>Information we use</h2>
          <p>
            We use account and contact details such as your name, email address, phone
            number and account identifier to sign you in and provide support. The Student
            app displays your classes, attendance, learning resources, profile and billing
            information. The UCAT app uses your study plan, question responses, mock exam
            results, progress, referrals and subscription status to provide its learning
            features. We may process content you create, such as flashcards or study notes.
          </p>
          <p>
            If you enable push notifications, we store a token for each registered device
            and your notification preferences. We also receive basic app activity and
            diagnostic information needed to operate, secure and improve the apps, such as
            feature usage, crashes and performance data. Related web pages may use cookies
            and similar technology as described in our general privacy policy.
          </p>

          <h2>How we use and share information</h2>
          <p>
            We use this information to provide tutoring and UCAT services, authenticate
            accounts, show learning and billing records, send requested service messages,
            respond to support requests, prevent misuse and improve reliability. We do not
            sell your information or use the apps to track you across other companies’ apps
            and websites for advertising.
          </p>
          <p>
            Service providers process information for us where needed to operate these
            features. These include Supabase for account and application data, Expo and
            Apple or Google for push delivery, Sentry for UCAT crash diagnostics, and
            payment and analytics providers used by related web flows. We require providers
            acting on our behalf to protect personal information under appropriate
            confidentiality and security obligations.
          </p>

          <h2>Your choices</h2>
          <p>
            Push notifications are optional. You can turn them off for a device in its
            operating-system settings or in the app, and choose notification categories in
            the app. Category choices sync across your devices for each product. You can
            update your profile in the app or its linked account pages.
          </p>

          <h2>Retention and deletion</h2>
          <p>
            We keep account and service records while they are needed to provide the
            service, resolve issues and meet applicable record-keeping obligations. Some
            tutoring and payment records may need to remain after an online product account
            is closed. You can start UCAT product-account deletion from UCAT app Settings
            → My profile → Delete account. For Student app account access or data requests,
            including deletion requests, contact{" "}
            <a href="mailto:admin@altitutor.com">admin@altitutor.com</a>. Parents or
            guardians may contact us on a student’s behalf. We will explain what can be
            deleted or must be retained when we respond.
          </p>

          <h2>Contact</h2>
          <p>
            For privacy questions, access requests, corrections, withdrawal of consent or
            deletion requests, email{" "}
            <a href="mailto:admin@altitutor.com">admin@altitutor.com</a> or use our{" "}
            <Link href="/about/contact/">contact page</Link>.
          </p>
        </div>
      </section>
    </SiteFrame>
  );
}
