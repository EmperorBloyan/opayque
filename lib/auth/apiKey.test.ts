import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiKeyHeader, buildKeyHash, isValidPublishableKey, resolveMerchantAccessStatus } from './apiKey.ts';

test('normalizeApiKeyHeader trims bearer prefixes and whitespace', () => {
  assert.equal(normalizeApiKeyHeader('Bearer   opq_live_abc123   '), 'opq_live_abc123');
  assert.equal(normalizeApiKeyHeader('Bearer opq_test_xyz'), 'opq_test_xyz');
  assert.equal(normalizeApiKeyHeader(null), null);
});

test('buildKeyHash produces a stable SHA256 hash', () => {
  assert.equal(buildKeyHash('opq_live_abc123'), '974e08259b06623e4001249873f1f6bfea6c1e4d18eeb0d479d61ed104b6a917');
});

test('valid publishable keys are recognized and missing merchant access status falls back to approved', () => {
  assert.equal(isValidPublishableKey('osk_live_pub_abc123'), true);
  assert.equal(isValidPublishableKey('osk_test_pub_xyz987'), true);
  assert.equal(isValidPublishableKey('osk_live_secret_key'), false);
  assert.equal(resolveMerchantAccessStatus(null, 'osk_live_pub_abc123'), 'approved');
  assert.equal(resolveMerchantAccessStatus(undefined, 'osk_test_pub_xyz987'), 'approved');
  assert.equal(resolveMerchantAccessStatus('pending', 'osk_live_pub_abc123'), 'pending');
});
