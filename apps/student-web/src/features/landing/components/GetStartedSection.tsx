'use client';

import Link from 'next/link';
import { Button } from '@altitutor/ui';
import { studentBtnPrimary } from '@/shared/lib/student-visual';
import { cn } from '@/shared/utils';
import { SectionWrapper } from './SectionWrapper';
import { ArrowRight } from 'lucide-react';

interface GetStartedSectionProps {
  /** Whether the user is logged in - provided by app-level composition */
  isLoggedIn: boolean;
}

export function GetStartedSection({ isLoggedIn }: GetStartedSectionProps) {

  return (
    <SectionWrapper id="getstarted" className="bg-brand-lightBlue dark:bg-brand-darkBlue flex items-center">
      <div className="w-full">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">
            Let&apos;s get started
          </h2>
        </div>

        {isLoggedIn ? (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-lg p-6 md:p-8 bg-white/90 dark:bg-white/10 overflow-hidden cursor-pointer group">
              <Link href="/dashboard" className="block">
                <h3 className="text-2xl md:text-3xl font-semibold mb-4 text-landing-dark-grey dark:text-foreground">
                  Go to Dashboard
                </h3>
                <p className="text-landing-dark-grey dark:text-muted-foreground mb-6">
                  Welcome back! Access your courses, assignments, and resources from your dashboard.
                </p>
                <Button className={cn(studentBtnPrimary, 'w-full md:w-auto')} variant="default">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
          <div className="rounded-lg p-6 md:p-8 bg-white/90 dark:bg-white/10 overflow-hidden cursor-pointer group">
            <Link
              href="/booking/trial-session"
              className="block"
            >
              <h3 className="text-2xl md:text-3xl font-semibold mb-4 text-landing-dark-grey dark:text-foreground">
                Become an in person student
              </h3>
              <p className="text-landing-dark-grey dark:text-muted-foreground mb-6">
                All of our in person students get <strong>free access</strong> to the online courses
                for the subjects they study with us.
              </p>
              <p className="text-landing-dark-grey dark:text-muted-foreground mb-6">
                If you&apos;re interested in becoming a student, click here to book a{' '}
                <strong>free trial session</strong> at our office in the Adelaide CBD.
              </p>
              <Button className={cn(studentBtnPrimary, 'w-full md:w-auto')} variant="default">
                Book a trial session
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="rounded-lg p-6 md:p-8 bg-white/90 dark:bg-white/10 overflow-hidden">
            <h3 className="text-2xl md:text-3xl font-semibold mb-4 text-landing-dark-grey dark:text-foreground">
              Online access
            </h3>
            <p className="text-landing-dark-grey dark:text-muted-foreground mb-6">
              All of our courses are available for purchase via either as a{' '}
              <strong>monthly subscription</strong> or for the <strong>whole year</strong>.
            </p>
            <p className="text-landing-dark-grey dark:text-muted-foreground mb-6">
              Your account will be created upon enrolment of your first course.
            </p>
            <Button className={cn(studentBtnPrimary, 'w-full md:w-auto')} variant="default" disabled>
              Coming soon
            </Button>
          </div>
        </div>
        )}
      </div>
    </SectionWrapper>
  );
}

