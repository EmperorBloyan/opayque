import test from 'node:test';
import assert from 'node:assert/strict';

import { validateMerchantSessionRequirements } from './merchantSessionRules';

test('rejects merchant without settlement wallet', () => {
  const result = validateMerchantSessionRequirements({
    id: 'merchant-123',
    api_access_status: 'active',
    api_key: 'osk_test_abc',
  });

  assert.equal(result.ok, false);
  assert.match(result.error ?? '', /settlement wallet/i);
});

test('accepts fully configured merchant', () => {
  const result = validateMerchantSessionRequirements({
    id: 'merchant-123',
    api_access_status: 'active',
    api_key: 'osk_test_abc',
    settlement_wallet_address: 'So11111111111111111111111111111111111111112',
  });

  assert.equal(result.ok, true);
  assert.equal(result.error, undefined);
});
