import { afterEach, describe, expect, it } from 'vitest';
import { decryptWebhookSecret, encryptWebhookSecret } from './secrets';

afterEach(() => {
  delete process.env.WEBHOOK_ENCRYPTION_KEY;
});

describe('webhook secret encryption', () => {
  it('round-trips secrets without storing plaintext', () => {
    process.env.WEBHOOK_ENCRYPTION_KEY = 'test-encryption-key';
    const encrypted = encryptWebhookSecret('whsec_test');
    expect(encrypted).not.toContain('whsec_test');
    expect(decryptWebhookSecret(encrypted)).toBe('whsec_test');
  });

  it('rejects missing encryption configuration', () => {
    expect(() => encryptWebhookSecret('whsec_test')).toThrow('WEBHOOK_ENCRYPTION_KEY');
  });
});
