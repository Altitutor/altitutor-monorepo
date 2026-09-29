import type { Metadata } from "next";
import Link from "next/link";

import { SiteFrame } from "@/features/marketing/components/site-frame";
import styles from "@/features/marketing/marketing.module.css";

export const metadata: Metadata = {
  title: "Mobile account deletion | Altitutor",
  description: "Request deletion of an Altitutor Student account or delete an Altitutor UCAT account.",
};

export default function MobileAccountDeletionPage() {
  return (
    <SiteFrame>
      <section className={styles.legal}>
        <p className={styles.eyebrow}>Altitutor</p>
        <h1>Mobile account deletion</h1>
        <div className={styles.copy}>
          <p>Last updated: 29 September 2026</p>
          <p>
            This page explains how to delete an Altitutor Student or Altitutor UCAT
            account and its associated data. Altitutor Pty Ltd provides both apps.
          </p>

          <h2>Altitutor Student</h2>
          <p>
            In the Student app, open Menu → Request account deletion. Email{" "}
            <a href="mailto:admin@altitutor.com?subject=Altitutor%20Student%20account%20deletion">
              admin@altitutor.com
            </a>{" "}
            from the address associated with your account, with the subject “Altitutor
            Student account deletion”. You can also use that email link without the app.
            A parent or guardian can make the request on a student’s behalf. We will
            verify the request before deleting the account.
          </p>

          <h2>Altitutor UCAT</h2>
          <p>
            In the UCAT app, open Settings → My profile → Delete account and follow
            the confirmation steps. If you cannot access the app, email{" "}
            <a href="mailto:admin@altitutor.com?subject=Altitutor%20UCAT%20account%20deletion">
              admin@altitutor.com
            </a>{" "}
            from your account address.
          </p>

          <h2>What happens to your data</h2>
          <p>
            We delete or de-identify account profile information and product data
            that we no longer need, such as study activity, flashcards and notification
            settings. Student tutoring records, invoices and payment records may need
            to be retained to meet legal or accounting obligations or resolve a
            dispute. Australian company financial records are generally retained for
            seven years after the relevant transaction. We will tell you which data
            we have deleted or retained when we respond. You can also request deletion
            of particular data without closing your account by emailing us.
          </p>
          <p>
            For more information, read our{" "}
            <Link href="/mobile-privacy/">mobile app privacy notice</Link>.
          </p>
        </div>
      </section>
    </SiteFrame>
  );
}
