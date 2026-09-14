const RECENT_AUTH_WINDOW_MS = 10 * 60 * 1000;

export function hasRecentAuthentication(lastSignInAt: string | null | undefined) {
  if (!lastSignInAt) return false;
  const timestamp = Date.parse(lastSignInAt);
  return Number.isFinite(timestamp) && Date.now() - timestamp <= RECENT_AUTH_WINDOW_MS;
}
