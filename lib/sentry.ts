type SentryLike = {
  captureException?: (err: unknown) => void;
};

const sentryStub: SentryLike = {};

function initSentry() {
  if (typeof window !== 'undefined' || !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  try {
    // Avoid pulling the full Sentry runtime into the build path when no DSN is configured.
    // The app still exposes a safe capture hook for server-side logging.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const runtime = require('@sentry/nextjs') as SentryLike & { init?: (options: unknown) => void };
    runtime.init?.({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0.1,
      debug: process.env.NODE_ENV === 'development',
    });
    if (typeof runtime.captureException === 'function') {
      sentryStub.captureException = runtime.captureException.bind(runtime);
    }
  } catch {
    // ignore and fall back to console logging
  }
}

initSentry();

export function captureException(err: unknown) {
  try {
    if (sentryStub.captureException) {
      sentryStub.captureException(err);
      return;
    }
  } catch {
    // swallow
  }
  // eslint-disable-next-line no-console
  console.error('Captured exception:', err);
}

export default sentryStub;
