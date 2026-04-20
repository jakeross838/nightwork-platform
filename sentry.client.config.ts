// Client-side Sentry. Loaded in the browser bundle; catches React render
// errors, unhandled promise rejections, fetch failures, etc. No-op when
// NEXT_PUBLIC_SENTRY_DSN is not set, so local dev stays quiet unless the
// developer opts in.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Don't ship PII by default — user emails etc. can sneak in otherwise.
    sendDefaultPii: false,
  });
}
