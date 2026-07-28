import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  debug: process.env.NODE_ENV === 'development',
});

export { Sentry };

export function captureException(err: any) {
  try {
    // prefer Sentry if initialized
    if (Sentry && typeof Sentry.captureException === 'function') {
      Sentry.captureException(err);
      return;
    }
  } catch (e) {
    // swallow
  }
  // fallback to console
  // eslint-disable-next-line no-console
  console.error('Captured exception:', err);
}

export default Sentry;
