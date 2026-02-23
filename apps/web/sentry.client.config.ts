// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (!dsn) {
  console.warn('[Sentry Client] DSN not configured, Sentry is disabled');
} else {
  Sentry.init({
    dsn,

    // Use tunnel to avoid ad-blockers
    tunnel: '/monitoring',

    // Adjust this value in production
    tracesSampleRate: 0.1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Only enable replay in production
    replaysOnErrorSampleRate: 0.1,
    replaysSessionSampleRate: 0,

    // Filter out common non-actionable errors
    beforeSend(event) {
      // Ignore errors from browser extensions
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some((frame) => frame.filename?.includes('extension://'))) {
        return null;
      }

      // Ignore ResizeObserver errors (common browser quirk)
      if (event.message?.includes('ResizeObserver')) {
        return null;
      }

      return event;
    },
  });
}
