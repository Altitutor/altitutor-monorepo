"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@altitutor/ui";
import { MARKETING_TOKENS } from "@altitutor/shared";
import { ArrowRight } from "lucide-react";
import type { UcatFeature } from "./ucat-feature-data";
import { UcatFeatureDetailPreview } from "./ucat-feature-micro-ui";

const { typography: typo } = MARKETING_TOKENS;

const DIALOG_EASE = [0.32, 0.72, 0, 1] as const;

type UcatFeatureDetailDialogProps = {
  feature: UcatFeature;
};

export function UcatFeatureDetailDialog({ feature }: UcatFeatureDetailDialogProps) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const Icon = feature.icon;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border border-marketing-charcoal/12 bg-white px-4 py-2 text-sm font-semibold text-marketing-charcoal shadow-sm transition hover:border-marketing-charcoal/20 hover:bg-marketing-cream ${typo.secondarySans}`}
        >
          Learn more <ArrowRight className="size-4" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent
        className="flex max-h-[min(92vh,900px)] flex-col gap-0 overflow-hidden border-marketing-charcoal/10 bg-marketing-cream p-0 text-marketing-charcoal sm:max-w-3xl sm:rounded-[1.75rem]"
        mobilePresentation="bottom-sheet"
      >
        <motion.div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 sm:p-8"
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: reduceMotion ? 0 : 0.28,
            ease: DIALOG_EASE,
          }}
        >
          <DialogHeader className="pr-6 text-left">
            <div className="flex items-center gap-3">
              <span
                className={`flex size-10 shrink-0 items-center justify-center rounded-full ${feature.theme.iconBg}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <p
                  className={`text-xs font-semibold uppercase tracking-[0.14em] ${typo.dataMono}`}
                  style={{ color: feature.theme.accent }}
                >
                  {feature.eyebrow}
                </p>
                <DialogTitle
                  className={`mt-1 text-2xl font-semibold tracking-tight text-marketing-charcoal sm:text-3xl ${typo.headingSans}`}
                >
                  {feature.title}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription
              className={`mt-4 text-sm leading-relaxed text-marketing-charcoal/58 ${typo.secondarySans}`}
            >
              {feature.body}
            </DialogDescription>
          </DialogHeader>

          <motion.div
            className="mt-8 space-y-10"
            initial={reduceMotion ? false : "hidden"}
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: reduceMotion ? 0 : 0.08,
                  delayChildren: reduceMotion ? 0 : 0.12,
                },
              },
            }}
          >
            {feature.details.map((detail) => (
              <motion.article
                key={detail.title}
                variants={{
                  hidden: reduceMotion
                    ? { opacity: 1, y: 0 }
                    : { opacity: 0, y: 14 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.28, ease: DIALOG_EASE },
                  },
                }}
              >
                <h3
                  className={`text-lg font-semibold tracking-tight text-marketing-charcoal ${typo.headingSans}`}
                >
                  {detail.title}
                </h3>
                <p
                  className={`mt-2 text-sm leading-relaxed text-marketing-charcoal/58 ${typo.secondarySans}`}
                >
                  {detail.body}
                </p>
                <div className="mt-4">
                  <UcatFeatureDetailPreview id={detail.previewId} />
                </div>
              </motion.article>
            ))}
          </motion.div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
