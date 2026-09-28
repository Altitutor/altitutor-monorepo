"use client";

import { HeartHandshake, Scale, Sparkles, UsersRound } from "lucide-react";
import { SubsidyLearnMoreDialog } from "./subsidy-learn-more-dialog";
import {
  MARKETING_BODY_DESCRIPTION_CLASS,
  MARKETING_CARD_TITLE_CLASS,
} from "../section-styles";
import { MARKETING_TYPOGRAPHY as typo } from "../theme";
import styles from "../marketing.module.css";

const values = [
  {
    title: "Equity",
    subtitle: "Fair Opportunity for All",
    summary:
      "We make transformative education accessible to students regardless of their background or financial situation.",
    icon: Scale,
    paragraphs: [
      "At Altitutor, we believe in the transformative power of education and its ability to level the playing field. Inspired by the principle of loving those around us as Jesus loved us, our principal mission is to offer a fair opportunity to every student, regardless of their background or financial situation.",
      "At the forefront of this mission stands our subsidy program, which provides students in need with the chance to study with us for free or at a reduced cost. We stand firmly against the notion that quality education should be a privilege of the wealthy; instead, we strive to make a real, tangible change in the lives of the students we encounter.",
      "Our not-for-profit model ensures that every dollar we earn is reinvested into our mission to educate and empower, or donated to those who need it most through the charities we support.",
    ],
  },
  {
    title: "Humanity",
    subtitle: "Valuing Relationships Beyond Roles",
    summary:
      "We build genuine relationships and support students and staff as whole people, beyond their roles or achievements.",
    icon: HeartHandshake,
    paragraphs: [
      "Altitutor's principle of humanity guides us to foster genuine connections, where every interaction is an opportunity to support, encourage, and understand one another on a personal level.",
      "Our commitment goes beyond academic success; it is about celebrating their achievements, understanding their passions, and supporting them through their challenges.",
      "Similarly, we view our staff not just as employees but as part of the Altitutor family, dedicating ourselves to walking alongside them in their professional and personal journeys.",
      "We create a nurturing and supportive environment where we prioritise personal relationships, embodying our vision of a community where everyone is valued, heard, and empowered to grow.",
    ],
  },
  {
    title: "Excellence",
    subtitle: "Striving with Grace",
    summary:
      "We keep improving the education we offer, pursuing excellence with compassion, humility, and grace.",
    icon: Sparkles,
    paragraphs: [
      "In all we do, Altitutor is dedicated to fostering an environment where the pursuit of excellence is guided by compassion, humility, and a deep-seated faith in the transformative power of education.",
      "Altitutor is anchored in the pursuit of excellence, inspired by the wisdom of Colossians 3:23, which encourages us to do everything with all our heart, as for the Lord, not for human masters. This value drives us to continually seek improvement and deliver the best possible education to every student we encounter.",
      "We recognise the delicate balance between striving for excellence and understanding that our worth is not defined by our achievements. Grounded in the grace that saves us, as echoed in the message of Psalm 121:1-2, we are reminded that our ultimate help and strength come from God.",
    ],
  },
  {
    title: "Community",
    subtitle: "Cultivating Passion and Connection",
    summary:
      "We make learning a shared experience where students connect, grow together, and form lasting friendships.",
    icon: UsersRound,
    paragraphs: [
      "At the core of Altitutor is our commitment to cultivating a vibrant, supportive community that ignites a passion for learning in students. We envision Altitutor as a place where students are excited to come, not just for the academic gains but for the joy of learning and the bonds of friendship that are formed within our walls.",
      "Our thriving online community further extends this connection, offering a platform for students to interact, discuss, and grow together. Altitutor is not just about tutoring; it is about building a community where lifelong friendships are made, and learning becomes a shared adventure.",
    ],
  },
] as const;

export function AboutValues() {
  return (
    <div className={styles.valuesGrid} data-scroll-stagger>
      {values.map((value, index) => {
        const Icon = value.icon;
        return (
          <article
            key={value.title}
            className="flex min-w-0 flex-col rounded-[30px] bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-black/[0.05] sm:p-8"
          >
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-marketing-primary/10 text-marketing-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <p className={`text-base font-semibold text-marketing-primary ${typo.secondarySans}`}>
                {String(index + 1).padStart(2, "0")} / Our values
              </p>
            </div>
            <h3 className={`mt-5 ${MARKETING_CARD_TITLE_CLASS} ${typo.headingSans}`}>
              {value.title}
            </h3>
            <p className={`mt-5 flex-1 ${MARKETING_BODY_DESCRIPTION_CLASS} ${typo.secondarySans}`}>
              {value.summary}
            </p>
            <div className="mt-6">
              <SubsidyLearnMoreDialog
                eyebrow={value.subtitle}
                title={value.title}
                paragraphs={value.paragraphs}
                icon={Icon}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
