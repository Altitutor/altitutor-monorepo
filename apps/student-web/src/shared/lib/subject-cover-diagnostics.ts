import { createSubjectCoverObserver } from '@altitutor/shared';
import * as Sentry from '@sentry/nextjs';

export const observeSubjectCover = createSubjectCoverObserver('student-web', Sentry.captureEvent);
