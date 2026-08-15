export function isValidPublishableKey(value: string | null | undefined) {
  if (typeof value !== 'string') return false;

  const trimmed = value.trim();
  if (!trimmed) return false;

  return /^(osk_(live|test)_pub_[A-Za-z0-9_-]+)$/i.test(trimmed);
}

export function resolveMerchantAccessStatus(
  status: string | null | undefined,
  keyValue?: string | null,
): 'pending' | 'active' | 'revoked' | 'approved' {
  const normalizedStatus = typeof status === 'string' ? status.trim().toLowerCase() : '';

  if (normalizedStatus === 'active' || normalizedStatus === 'revoked' || normalizedStatus === 'pending') {
    return normalizedStatus as 'pending' | 'active' | 'revoked';
  }

  if (normalizedStatus === 'approved') {
    return 'approved';
  }

  const trimmedKey = typeof keyValue === 'string' ? keyValue.trim() : '';
  if (trimmedKey && /^osk_(live|test)_[A-Za-z0-9_-]+$/i.test(trimmedKey)) {
    return 'approved';
  }

  if (trimmedKey && /^opq_(live|test)_[A-Za-z0-9_-]+$/i.test(trimmedKey)) {
    return 'approved';
  }

  return 'pending';
}
