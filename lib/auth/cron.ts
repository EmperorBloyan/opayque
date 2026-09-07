import crypto from 'node:crypto';

export function isAuthorizedCronRequest(request: Request): boolean {
  const configured = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get('authorization')?.trim() || '';
  if (!configured || !authorization.startsWith('Bearer ')) return false;
  const provided = authorization.slice('Bearer '.length).trim();
  const expected = Buffer.from(configured);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}
