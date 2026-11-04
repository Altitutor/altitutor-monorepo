import type { Metadata } from "next";
import Link from "next/link";

import { SiteFrame } from "@/features/marketing/components/site-frame";
import styles from "@/features/marketing/marketing.module.css";

export const metadata: Metadata = {
  title: "Mobile app privacy | Altitutor",
  description: "How Altitutor handles information in its Student, UCAT and Teaching apps.",
};

export default function MobilePrivacyPage() {
  return (
    <SiteFrame>
      <section className={styles.legal}>
        <p className={styles.eyebrow}>Altitutor</p>
        <h1>Mobile app privacy</h1>
        <div className={styles.copy}>
          <p>Last updated: 3 November 2026</p>
          <p>
            This notice applies to the Altitutor Student, Altitutor UCAT and Altitutor Teaching apps,
            including the account pages they open in a browser. It supplements our{" "}
            <Link href="/privacy-policy/">general privacy policy</Link>. Altitutor Pty Ltd
            is responsible for these services. Contact us at{" "}
            <a href="mailto:admin@altitutor.com">admin@altitutor.com</a>.
          </p>

          <h2 id="teaching">Altitutor Teaching for iPad</h2>
          <p>
            Teaching is a workspace for authorized Altitutor staff. It uses your staff
            account, assigned sessions, student rosters and lesson resources to provide
            its teaching features. Sign-in details are sent securely to our Tutor portal
            to authenticate you. The app does not store your password. Session tokens and
            the staff sign-in directory are stored in device-only Keychain storage. The
            directory contains active staff names, account identifiers and login emails;
            retaining it after sign-out lets staff select their name on a shared office
            iPad, but does not grant access without signing in.
          </p>
          <p>
            Downloaded worksheets and solutions, PDF annotations, cached session details
            and unfinished lesson logs are stored on the iPad with file protection,
            separated by tutor, session and backend. These local lesson files are excluded
            from device backup. Signing out clears the active session and classroom
            display while retaining your local lessons for your next sign-in. Uninstalling
            the app or erasing the iPad removes these local files and annotations.
          </p>
          <p>
            Confirming a lesson log sends the recorded lesson activity, student and
            resource selections, notes and tutor account identifier to the Tutor portal.
            Selected annotated worksheets and imported lesson PDFs are uploaded privately
            and become available to the confirmed student recipients and authorized session
            tutors when the log is submitted. These shared PDF snapshots expire one year
            after submission; general resource catalog permissions do not change. Solutions
            are not included in this lesson sharing. Printing uploads a separate copy of the
            previewed PDF to the office print service. That copy is deleted 24 hours after
            the print job reaches a final result; queued and in-progress jobs retain their
            copy. Unsubmitted uploads expire after 24 hours. Print audit records and expired
            lesson-file references may remain in the lesson history. Sharing exports a PDF through
            the system share sheet to the destination you choose; temporary exported files
            are cleaned up after sharing or on the next launch. Classroom presentation
            displays the worksheet and annotations on the connected display while keeping
            the app's solutions pane private.
          </p>
          <p>
            Our hosting, authentication, storage and diagnostic providers process data
            needed to operate the Tutor portal and its APIs. Teaching does not include
            advertising or a native cross-app tracking SDK. For access, corrections,
            withdrawal of account access or deletion requests, contact{" "}
            <a href="mailto:admin@altitutor.com">admin@altitutor.com</a>. Local annotations
            remain on the iPad unless removed there; retained business and lesson records
            follow the retention rules below.
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
            including deletion requests, follow our{" "}
            <Link href="/mobile-account-deletion/">mobile account deletion steps</Link>.
            Parents or guardians may contact us on a student’s behalf. We will explain
            what can be deleted or must be retained when we respond.
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
