// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

const dsn = process.env['SENTRY_DSN'] || process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (!dsn) {
  console.warn('[Sentry] DSN not configured, Sentry is disabled');
} else {
  console.warn('[Sentry] Initializing with DSN:', dsn.substring(0, 30) + '...');
  Sentry.init({
    dsn,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 0.1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: process.env.NODE_ENV === 'development',

    // Uncomment the line below to enable Spotlight (https://spotlightjs.com)
    // spotlight: process.env.NODE_ENV === 'development',

    // Ensure errors are sent even with low sample rate
    beforeSend(event) {
      // Always send errors
      return event;
    },
  });
}
