import { createSubjectCoverObserver } from '@altitutor/shared';
import * as Sentry from '@sentry/nextjs';

export const observeSubjectCover = createSubjectCoverObserver('admin-web', Sentry.captureEvent);
