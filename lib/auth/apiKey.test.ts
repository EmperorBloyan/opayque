import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiKeyHeader, buildKeyHash } from './apiKey';

test('normalizeApiKeyHeader trims bearer prefixes and whitespace', () => {
  assert.equal(normalizeApiKeyHeader('Bearer   opq_live_abc123   '), 'opq_live_abc123');
  assert.equal(normalizeApiKeyHeader('Bearer opq_test_xyz'), 'opq_test_xyz');
  assert.equal(normalizeApiKeyHeader(null), null);
});

test('buildKeyHash produces a stable SHA256 hash', () => {
  assert.equal(buildKeyHash('opq_live_abc123'), '5788e1e7a5a6dcd2f8f8aab8d4072117f7d2862c30f13f4d0d1d35d62fbb8f48');
});
