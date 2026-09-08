import { describe, expect, it, afterEach } from 'vitest';
import { isAuthorizedCronRequest } from './cron';

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('cron authentication', () => {
  it('fails closed when the secret is missing', () => {
    expect(isAuthorizedCronRequest(new Request('http://localhost', { headers: { authorization: 'Bearer undefined' } }))).toBe(false);
  });

  it('requires the exact bearer secret', () => {
    process.env.CRON_SECRET = 'cron-secret';
    expect(isAuthorizedCronRequest(new Request('http://localhost', { headers: { authorization: 'Bearer cron-secret' } }))).toBe(true);
    expect(isAuthorizedCronRequest(new Request('http://localhost', { headers: { authorization: 'Bearer wrong' } }))).toBe(false);
    expect(isAuthorizedCronRequest(new Request('http://localhost', { headers: { authorization: 'Basic cron-secret' } }))).toBe(false);
  });
});
